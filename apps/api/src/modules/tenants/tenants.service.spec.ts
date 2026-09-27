import {
  asAudit,
  asFiles,
  asNotify,
  asNrc,
  asPrisma,
  auditMock,
  callArg,
  callData,
  filesMock,
  notifyMock,
  nrcMock,
} from '../../testing/mocks';
import { TenantsService } from './tenants.service';

function setup(overrides: {
  tenant?: Record<string, unknown> | null;
  file?: Record<string, unknown> | null;
  admins?: { id: string }[];
  storageMissing?: boolean;
} = {}) {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.tenant === undefined
          ? { id: 't1', status: 'pending_verification' }
          : overrides.tenant,
      ),
      update: jest.fn().mockResolvedValue({
        id: 't1',
        name: 'Chilenje Community SACCO',
        type: 'sacco',
        status: 'pending_verification',
        verificationNote: null,
        bozSubmittedAt: new Date('2026-09-22T10:00:00Z'),
        bozFile: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
      }),
    },
    file: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.file === undefined
          ? {
              id: 'f1',
              tenantId: 't1',
              kind: 'boz_certificate',
              checksum: 'etag-123',
            }
          : overrides.file,
      ),
    },
    user: {
      findMany: jest
        .fn()
        .mockResolvedValue(overrides.admins ?? [{ id: 'admin1' }]),
    },
  };
  const audit = auditMock();
  const notify = notifyMock();
  const nrc = nrcMock();
  const files = filesMock();
  if (overrides.storageMissing) {
    files.assertObjectPresent.mockRejectedValue(
      new Error(
        'The certificate is no longer in storage — upload it again before submitting',
      ),
    );
  }

  const service = new TenantsService(
    asPrisma(prisma),
    asAudit(audit),
    asNotify(notify),
    asNrc(nrc),
    asFiles(files),
  );

  return { service, prisma, audit, notify, nrc, files };
}

const dto = { fileId: 'f1', ownerNrc: '245711/63/1' };

describe('TenantsService.submitVerification', () => {
  it('moves a pending tenant into review and stamps the submission time', async () => {
    const { service, prisma } = setup();

    const result = await service.submitVerification('t1', 'u1', dto);

    const data = callData(prisma.tenant.update);
    expect(data['status']).toBe('pending_verification');
    expect(data['bozSubmittedAt']).toBeInstanceOf(Date);
    expect(data['verificationNote']).toBeNull();
    expect(result.id).toBe('t1');
  });

  it('encrypts the owner NRC and links the certificate by relation', async () => {
    const { service, prisma, nrc } = setup();

    await service.submitVerification('t1', 'u1', dto);

    expect(nrc.encrypt).toHaveBeenCalledWith('245711/63/1');
    const data = callData(prisma.tenant.update);
    expect(data['ownerNrcEncrypted']).toBe('enc(245711/63/1)');
    // The FK lives on File, so this must be a connect rather than a scalar.
    expect(data['bozFile']).toEqual({ connect: { id: 'f1' } });
  });

  it('never writes the NRC into the audit diff', async () => {
    const { service, audit } = setup();

    await service.submitVerification('t1', 'u1', dto);

    const entry = callArg<{ diff: unknown }>(audit.record) ?? { diff: null };
    expect(JSON.stringify(entry.diff)).not.toContain('245711');
    expect(entry.diff).toEqual({ fileId: 'f1', ownerNrcSupplied: true });
  });

  it('notifies every platform admin', async () => {
    const { service, notify } = setup({
      admins: [{ id: 'a1' }, { id: 'a2' }],
    });

    await service.submitVerification('t1', 'u1', dto);

    expect(notify.create).toHaveBeenCalledTimes(2);
    expect(callArg(notify.create, 0, 0)).toBe('a1');
    expect(callArg(notify.create, 0, 1)).toBe('verification');
  });

  it('refuses a tenant that is already verified', async () => {
    const { service, prisma } = setup({
      tenant: { id: 't1', status: 'active' },
    });

    await expect(service.submitVerification('t1', 'u1', dto)).rejects.toThrow(
      /already verified/,
    );
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('refuses a suspended tenant', async () => {
    const { service } = setup({ tenant: { id: 't1', status: 'suspended' } });

    await expect(service.submitVerification('t1', 'u1', dto)).rejects.toThrow(
      /suspended/,
    );
  });

  it('allows resubmission after a rejection', async () => {
    const { service, prisma } = setup({
      tenant: { id: 't1', status: 'rejected' },
    });

    await service.submitVerification('t1', 'u1', dto);

    expect(prisma.tenant.update).toHaveBeenCalled();
  });

  it("404s on a file owned by another tenant", async () => {
    const { service } = setup({
      file: {
        id: 'f1',
        tenantId: 'someone-else',
        kind: 'boz_certificate',
        checksum: 'x',
      },
    });

    await expect(service.submitVerification('t1', 'u1', dto)).rejects.toThrow(
      /not found/i,
    );
  });

  it('rejects a non-certificate file', async () => {
    const { service } = setup({
      file: { id: 'f1', tenantId: 't1', kind: 'kyc_document', checksum: 'x' },
    });

    await expect(service.submitVerification('t1', 'u1', dto)).rejects.toThrow(
      /Bank of Zambia certificate/,
    );
  });

  it('rejects an upload that was never confirmed', async () => {
    const { service } = setup({
      file: {
        id: 'f1',
        tenantId: 't1',
        kind: 'boz_certificate',
        checksum: '',
      },
    });

    await expect(service.submitVerification('t1', 'u1', dto)).rejects.toThrow(
      /Confirm the upload/,
    );
  });

  it('rejects a confirmed certificate whose bytes are gone from storage', async () => {
    const { service, prisma } = setup({ storageMissing: true });

    await expect(service.submitVerification('t1', 'u1', dto)).rejects.toThrow(
      /no longer in storage/,
    );
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});

describe('TenantsService.me', () => {
  it('404s when the tenant row is missing', async () => {
    const { service } = setup({ tenant: null });

    await expect(service.me('t1')).rejects.toThrow(/not found/i);
  });
});

describe('TenantsService.publicInfo', () => {
  it('ships the first active product for the apply breakdown', async () => {
    const { service } = setup({
      tenant: {
        id: 't1',
        name: 'Chilenje Community SACCO',
        tagline: null,
        primaryColor: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        logoFile: null,
        terms: [],
        products: [
          {
            id: 'prod1',
            name: 'SACCO Installments',
            rateBps: 1500,
            originationFeeBps: 500,
            maxTerm: 12,
            frequency: 'monthly',
            repaymentStructure: 'installments',
          },
        ],
      },
    });

    const result = await service.publicInfo('t1');

    expect(result.product).toEqual({
      id: 'prod1',
      name: 'SACCO Installments',
      ratePct: 15,
      feePct: 5,
      maxTermMonths: 12,
      frequency: 'monthly',
      repaymentStructure: 'installments',
    });
  });

  it('returns product null when the lender has no active product', async () => {
    const { service } = setup({
      tenant: {
        id: 't1',
        name: 'Chilenje Community SACCO',
        tagline: null,
        primaryColor: null,
        createdAt: new Date('2026-09-01T00:00:00Z'),
        logoFile: null,
        terms: [],
        products: [],
      },
    });

    const result = await service.publicInfo('t1');

    expect(result.product).toBeNull();
  });
});
