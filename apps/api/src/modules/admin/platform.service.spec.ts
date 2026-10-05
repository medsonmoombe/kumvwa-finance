import { asAudit, asPrisma, auditMock, callArg } from '../../testing/mocks';
import { PlatformService, SETTING_DEFS } from './platform.service';

/** A Prisma stub holding the PlatformConfig overrides in memory. */
function prismaStub(initial: Record<string, unknown> = {}) {
  const rows = new Map<string, { key: string; value: unknown; updatedBy: string }>(
    Object.entries(initial).map(([key, value]) => [key, { key, value, updatedBy: 'u0' }]),
  );
  return {
    rows,
    prisma: asPrisma({
      platformConfig: {
        findMany: jest.fn(async () => [...rows.values()].map((r) => ({ ...r }))),
        upsert: jest.fn(async ({ where, create, update }: {
          where: { key: string };
          create: { key: string; value: unknown; updatedBy: string };
          update: { value: unknown; updatedBy: string };
        }) => {
          const existing = rows.get(where.key);
          const next = existing
            ? { ...existing, value: update.value, updatedBy: update.updatedBy }
            : { ...create };
          rows.set(where.key, next);
          return next;
        }),
        deleteMany: jest.fn(async ({ where }: { where: { key: string | { in: string[] } } }) => {
          const keys = typeof where.key === 'string' ? [where.key] : where.key.in;
          for (const key of keys) rows.delete(key);
          return { count: keys.length };
        }),
      },
    }),
  };
}

function service(initial: Record<string, unknown> = {}) {
  const { rows, prisma } = prismaStub(initial);
  const audit = auditMock();
  return { svc: new PlatformService(prisma, asAudit(audit)), rows, audit };
}

describe('PlatformService (settings)', () => {
  describe('defaults', () => {
    it('reports every catalogue setting as at its default when nothing is stored', async () => {
      const { svc } = service();
      const { items, groups } = await svc.list();

      expect(items).toHaveLength(Object.keys(SETTING_DEFS).length);
      expect(groups).toContain('General');
      for (const item of items) {
        expect(item.isDefault).toBe(true);
        expect(item.value).toEqual(item.default);
      }
    });

    it('reports the enforced state so the UI can flag inert switches', async () => {
      const { svc } = service();
      const { items } = await svc.list();
      const enforced = (key: string) => items.find((i) => i.key === key)?.enforced;

      expect(enforced('maintenance_mode')).toBe(true);
      expect(enforced('signup_enabled')).toBe(true);
      expect(enforced('client_app_enabled')).toBe(false);
    });

    it('falls back to the default when an override row is missing', async () => {
      const { svc } = service();
      await expect(svc.value<boolean>('maintenance_mode')).resolves.toBe(false);
    });
  });

  describe('set', () => {
    it('creates the override row on first write and audits the change', async () => {
      const { svc, audit } = service();
      const item = await svc.set('maintenance_mode', true, 'admin1');

      expect(item.value).toBe(true);
      expect(item.isDefault).toBe(false);
      const event = callArg<{ action: string; entityId: string; diff: Record<string, unknown> }>(
        audit.record,
      );
      expect(event).toMatchObject({
        action: 'platform.setting_set',
        entityId: 'maintenance_mode',
        diff: { from: false, to: true },
      });
    });

    it('rejects an unknown key instead of storing it', async () => {
      const { svc } = service();
      await expect(svc.set('nope', 'x', 'admin1')).rejects.toThrow(/Unknown setting/);
    });

    it('rejects a value of the wrong type', async () => {
      const { svc } = service();
      await expect(svc.set('maintenance_mode', 'yes', 'admin1')).rejects.toThrow(/boolean/);
      await expect(svc.set('maintenance_message', 42, 'admin1')).rejects.toThrow(/text/);
    });

    // The DTO types `value` as optional-unknown so the global ValidationPipe
    // keeps the property, which means an omitted value reaches the service.
    it('rejects a missing value', async () => {
      const { svc, rows } = service();
      await expect(svc.set('maintenance_mode', undefined, 'admin1')).rejects.toThrow(/boolean/);
      expect(rows.size).toBe(0);
    });

    it('rejects a number below the catalogue minimum', async () => {
      const { svc } = service();
      await expect(svc.set('max_loan_amount_minor', -1, 'admin1')).rejects.toThrow(/at least 0/);
    });

    it('rejects a select value outside the allowed options', async () => {
      const { svc } = service();
      await expect(svc.set('default_payment_provider', 'carrier_pigeon', 'admin1')).rejects.toThrow(
        /must be one of/,
      );
    });

    it('skips the write and the audit when the value has not changed', async () => {
      const { svc, audit } = service();
      const result = await svc.set('maintenance_mode', false, 'admin1');

      expect(result.isDefault).toBe(true);
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('remove / restore', () => {
    it('reverting a setting restores the catalogue default', async () => {
      const { svc } = service();
      await svc.set('maintenance_mode', true, 'admin1');
      const item = await svc.remove('maintenance_mode', 'admin1');

      expect(item.value).toBe(false);
      expect(item.isDefault).toBe(true);
    });

    it('removing an untouched setting is a no-op', async () => {
      const { svc, audit } = service();
      const item = await svc.remove('signup_enabled', 'admin1');

      expect(item.isDefault).toBe(true);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('restores every override in one audited action', async () => {
      const { svc, rows, audit } = service();
      await svc.set('maintenance_mode', true, 'admin1');
      await svc.set('signup_enabled', false, 'admin1');
      expect(rows.size).toBe(2);

      const { items } = await svc.restoreDefaults('admin1');

      expect(rows.size).toBe(0);
      expect(items.every((i) => i.isDefault)).toBe(true);
      expect(audit.record).toHaveBeenCalledTimes(3); // two sets + one restore
    });
  });

  describe('legacy flag API', () => {
    it('only exposes the boolean settings, and writes through the catalogue', async () => {
      const { svc } = service();
      await svc.setFlag('maintenance_mode', true, 'admin1');
      const { items } = await svc.allFlags();

      expect(items.map((i) => i.key)).toEqual(
        expect.arrayContaining(['maintenance_mode', 'signup_enabled']),
      );
      expect(items.every((i) => typeof i.value === 'boolean')).toBe(true);
      expect(items.find((i) => i.key === 'maintenance_mode')?.value).toBe(true);
    });
  });
});
