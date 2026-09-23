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

function setup(
  overrides: { tenant?: Record<string, unknown> | null } = {},
) {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.tenant === undefined
          ? {
              id: 't1',
              name: 'Chilenje Community SACCO',
              status: 'pending_verification',
              bozSubmittedAt: new Date('2026-09-20T00:00:00Z'),
              ownerNrcEncrypted: 'enc(245711/63/1)',
            }
          : overrides.tenant,
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
    const { service } = setup({
      tenant: {
        id: 't1',
        name: 'X',
        status: 'pending_verification',
        bozSubmittedAt: null,
      },
    });

    await expect(
      service.review('admin1', 't1', { decision: 'approve' }),
    ).rejects.toThrow(/not submitted/);
  });

  it('404s on an unknown tenant', async () => {
    const { service } = setup({ tenant: null });

    await expect(
      service.review('admin1', 'nope', { decision: 'approve' }),
    ).rejects.toThrow(/not found/i);
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
