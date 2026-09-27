import {
  asAudit,
  asNotify,
  asNrc,
  asPrisma,
  auditMock,
  callData,
  notifyMock,
  nrcMock,
} from '../../testing/mocks';
import { AdminService } from './admin.service';

/** A complete application: every checklist item the approve gate looks at. */
const READY_TENANT = {
  id: 't1',
  name: 'Chilenje Community SACCO',
  type: 'sacco',
  status: 'pending_verification',
  email: 'info@chilenje.zm',
  contactPerson: 'Ms. Bwalya',
  bozSubmittedAt: new Date('2026-09-20T00:00:00Z'),
  ownerNrcEncrypted: 'enc(245711/63/1)',
  bozFile: { id: 'f1', checksum: 'etag-123' },
  users: [{ id: 'owner1' }],
};

function setup(
  overrides: { tenant?: Record<string, unknown> | null } = {},
) {
  const readyTenant = { ...READY_TENANT };
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.tenant === undefined ? readyTenant : overrides.tenant,
      ),
      update: jest.fn().mockResolvedValue({
        id: 't1',
        name: 'Chilenje Community SACCO',
        status: 'active',
        verificationNote: null,
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'owner1' }) },
  };
  const audit = auditMock();
  const notify = notifyMock();
  const nrc = nrcMock();

  const service = new AdminService(
    asPrisma(prisma),
    asAudit(audit),
    asNotify(notify),
    asNrc(nrc),
  );

  return { service, prisma, audit, notify, nrc };
}

describe('AdminService.review', () => {
  it('activates the tenant and notifies the owner on approval', async () => {
    const { service, prisma, notify, audit } = setup();

    await service.review('admin1', 't1', { decision: 'approve' });

    const data = callData(prisma.tenant.update);
    expect(data['status']).toBe('active');
    expect(data['verificationNote']).toBeNull();
    expect(notify.create).toHaveBeenCalledWith(
      'owner1',
      'verification',
      'BOZ verification approved',
      expect.any(String),
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.verification_approve' }),
    );
  });

  it('stores the reviewer note on rejection', async () => {
    const { service, prisma, audit } = setup();

    await service.review('admin1', 't1', {
      decision: 'reject',
      reason: 'Certificate is unreadable',
    });

    const data = callData(prisma.tenant.update);
    expect(data['status']).toBe('rejected');
    expect(data['verificationNote']).toBe('Certificate is unreadable');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'tenant.verification_reject' }),
    );
  });

  it('requires a reason when rejecting', async () => {
    const { service, prisma } = setup();

    await expect(
      service.review('admin1', 't1', { decision: 'reject' }),
    ).rejects.toThrow(/reason is required/);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('refuses to approve an already-verified tenant', async () => {
    const { service } = setup({
      tenant: {
        id: 't1',
        name: 'X',
        status: 'active',
        bozSubmittedAt: new Date(),
      },
    });

    await expect(
      service.review('admin1', 't1', { decision: 'approve' }),
    ).rejects.toThrow(/already verified/);
  });

  it('refuses to approve before a certificate was submitted', async () => {
    const { service, prisma } = setup({
      tenant: { ...READY_TENANT, bozSubmittedAt: null },
    });

    await expect(
      service.review('admin1', 't1', { decision: 'approve' }),
    ).rejects.toThrow(/BOZ certificate has not been submitted/);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('404s on an unknown tenant', async () => {
    const { service } = setup({ tenant: null });

    await expect(
      service.review('admin1', 'nope', { decision: 'approve' }),
    ).rejects.toThrow(/not found/i);
  });

  it('refuses to approve when the certificate was never confirmed in storage', async () => {
    const { service, prisma } = setup({
      tenant: { ...READY_TENANT, bozFile: { id: 'f1', checksum: '' } },
    });

    await expect(
      service.review('admin1', 't1', { decision: 'approve' }),
    ).rejects.toThrow(/confirmed BOZ certificate/);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('names every missing item so the reviewer knows what to ask for', async () => {
    const { service, prisma } = setup({
      tenant: {
        ...READY_TENANT,
        type: '',
        contactPerson: null,
        ownerNrcEncrypted: null,
      },
    });

    await expect(
      service.review('admin1', 't1', { decision: 'approve' }),
    ).rejects.toThrow(
      /Business type is missing; Contact person is missing; Owner NRC is missing/,
    );
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

describe('AdminService.listTenants', () => {
  it('rejects an unknown status filter', async () => {
    const { service } = setup();

    await expect(service.listTenants('nonsense')).rejects.toThrow(
      /status must be one of/,
    );
  });

  it('accepts a real TenantStatus', async () => {
    const { service, prisma } = setup();

    await service.listTenants('pending_verification');

    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending_verification' } }),
    );
  });

  it('flags an incomplete application in the queue projection', async () => {
    const { service, prisma } = setup();
    prisma.tenant.findMany.mockResolvedValue([
      {
        ...READY_TENANT,
        verificationNote: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        users: [{ phone: '+260970000000', displayName: 'Ms. Bwalya' }],
        bozFile: {
          id: 'f1',
          kind: 'boz_certificate',
          mime: 'application/pdf',
          size: 10,
          createdAt: new Date('2026-09-20T00:00:00Z'),
          checksum: '',
        },
      },
    ]);

    const [row] = await service.listTenants();

    expect(row?.review).toEqual({
      canApprove: false,
      blockers: ['A confirmed BOZ certificate is required'],
    });
    // The storage checksum is server-side only — it must not ride along.
    expect(JSON.stringify(row)).not.toContain('checksum');
  });
});

describe('AdminService.ownerIdentity', () => {
  it('decrypts the NRC and records an audited pii.read', async () => {
    const { service, nrc, audit } = setup();

    const res = await service.ownerIdentity('admin1', 't1');

    expect(res.ownerNrc).toBe('245711/63/1');
    expect(nrc.decrypt).toHaveBeenCalledWith('enc(245711/63/1)');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pii.read', entityId: 't1' }),
    );
  });

  it('returns null without decrypting when no NRC was submitted', async () => {
    const { service, nrc } = setup({
      tenant: {
        id: 't1',
        name: 'X',
        status: 'pending_verification',
        ownerNrcEncrypted: null,
      },
    });

    const res = await service.ownerIdentity('admin1', 't1');

    expect(res.ownerNrc).toBeNull();
    expect(nrc.decrypt).not.toHaveBeenCalled();
  });
});
