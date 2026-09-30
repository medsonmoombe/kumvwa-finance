import {
  asAudit,
  asFiles,
  asNotify,
  asNrc,
  asPrisma,
  auditMock,
  callData,
  filesMock,
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
  tpin: '1000123456',
  contactPerson: 'Ms. Bwalya',
  businessDescription: 'Community lender serving small businesses in Lusaka.',
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
    tenantReviewEvent: { create: jest.fn().mockResolvedValue({ id: 'event1' }) },
    // Used by the borrower-document specs; harmless elsewhere.
    client: { findUnique: jest.fn().mockResolvedValue(null) },
    file: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const audit = auditMock();
  const notify = notifyMock();
  const nrc = nrcMock();
  const files = filesMock();

  const service = new AdminService(
    asPrisma(prisma),
    asAudit(audit),
    asNotify(notify),
    asNrc(nrc),
    asFiles(files),
  );

  return { service, prisma, audit, notify, nrc, files };
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
      'Business review approved',
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
    expect(prisma.tenantReviewEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'rejected',
          note: 'Certificate is unreadable',
        }),
      }),
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

  it('allows approval without an optional BOZ certificate', async () => {
    const { service, prisma } = setup({
      tenant: { ...READY_TENANT, bozSubmittedAt: null },
    });

    await service.review('admin1', 't1', { decision: 'approve' });
    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  it('404s on an unknown tenant', async () => {
    const { service } = setup({ tenant: null });

    await expect(
      service.review('admin1', 'nope', { decision: 'approve' }),
    ).rejects.toThrow(/not found/i);
  });

  it('allows approval when an optional certificate was never confirmed in storage', async () => {
    const { service, prisma } = setup({
      tenant: { ...READY_TENANT, bozFile: { id: 'f1', checksum: '' } },
    });

    await service.review('admin1', 't1', { decision: 'approve' });
    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  it('names every missing item so the reviewer knows what to ask for', async () => {
    const { service, prisma } = setup({
      tenant: {
        ...READY_TENANT,
        type: '',
        contactPerson: null,
        businessDescription: null,
        ownerNrcEncrypted: null,
        tpin: null,
      },
    });

    await expect(
      service.review('admin1', 't1', { decision: 'approve' }),
    ).rejects.toThrow(
      /Business type is missing; Contact person is missing; Business description is missing; Contact person NRC is missing; TPIN is missing/,
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

  it('does not block a complete application for an optional certificate', async () => {
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

    expect(row?.review).toEqual({ canApprove: true, blockers: [] });
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

describe('AdminService.clientNrcPhotoUrl', () => {
  function withClient(
    overrides: { client?: Record<string, unknown> | null; file?: Record<string, unknown> | null } = {},
  ) {
    const ctx = setup();
    ctx.prisma.client = {
      findUnique: jest.fn().mockResolvedValue(
        overrides.client === undefined
          ? {
              id: 'c1',
              nrcPhotoFileId: 'f-front',
              nrcBackPhotoFileId: 'f-back',
            }
          : overrides.client,
      ),
    };
    ctx.prisma.file = {
      findUnique: jest.fn().mockResolvedValue(
        overrides.file === undefined
          ? { id: 'f-front', storageKey: 'clients/nrc_photo/aa', mime: 'image/jpeg' }
          : overrides.file,
      ),
    };
    return ctx;
  }

  it('presigns the front face and audits the PII read', async () => {
    const { service, files, audit } = withClient();

    const res = await service.clientNrcPhotoUrl('c1', 'admin1', 'front');

    expect(files.presignGet).toHaveBeenCalledWith('clients/nrc_photo/aa', 'image/jpeg');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'pii.read',
        entityId: 'c1',
        diff: expect.objectContaining({ side: 'front', context: 'admin.nrc_viewer' }),
      }),
    );
  });

  it('presigns the back face when asked for it', async () => {
    const { service, files, prisma } = withClient();
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'f-back',
      storageKey: 'clients/nrc_photo/bb',
      mime: 'image/png',
    });

    const res = await service.clientNrcPhotoUrl('c1', 'admin1', 'back');

    expect(files.presignGet).toHaveBeenCalledWith('clients/nrc_photo/bb', 'image/png');
  });

  it('404s per face — a missing back photo is not a missing client', async () => {
    const { service, files } = withClient({
      client: { id: 'c1', nrcPhotoFileId: 'f-front', nrcBackPhotoFileId: null },
    });

    await expect(
      service.clientNrcPhotoUrl('c1', 'admin1', 'back'),
    ).rejects.toThrow(/No NRC back photo on file/);
    expect(files.presignGet).not.toHaveBeenCalled();
  });

  it('404s on an unknown client', async () => {
    const { service } = withClient({ client: null });

    await expect(
      service.clientNrcPhotoUrl('nope', 'admin1', 'front'),
    ).rejects.toThrow(/Client not found/);
  });
});
