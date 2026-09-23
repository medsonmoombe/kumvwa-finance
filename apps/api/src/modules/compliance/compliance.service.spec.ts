import {
  asAudit,
  asNrc,
  asPrisma,
  auditMock,
  callData,
  nrcMock,
} from '../../testing/mocks';
import { ComplianceService } from './compliance.service';

function setup(overrides: { blocking?: number; client?: unknown } = {}) {
  const prisma = {
    loan: { count: jest.fn().mockResolvedValue(overrides.blocking ?? 0) },
    client: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.client === undefined
          ? { id: 'c1', user: { id: 'u1' } }
          : overrides.client,
      ),
      update: jest.fn().mockReturnValue('CLIENT_UPDATE'),
    },
    user: { update: jest.fn().mockReturnValue('USER_UPDATE') },
    refreshToken: { updateMany: jest.fn().mockReturnValue('TOKEN_UPDATE') },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const audit = auditMock();
  const nrc = nrcMock();

  const service = new ComplianceService(
    asPrisma(prisma),
    asNrc(nrc),
    asAudit(audit),
  );

  return { service, prisma, audit, nrc };
}

describe('ComplianceService.requestDeletion', () => {
  it('refuses erasure while a loan is active or overdue', async () => {
    const { service, prisma, audit } = setup({ blocking: 2 });

    const res = await service.requestDeletion('c1');

    expect(res).toMatchObject({
      accepted: false,
      reason: 'active_loans',
      activeLoans: 2,
    });
    if (res.accepted) throw new Error('expected the request to be refused');
    expect(res.message).toContain('outstanding');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('checks for active AND overdue loans', async () => {
    const { service, prisma } = setup();

    await service.requestDeletion('c1');

    expect(prisma.loan.count).toHaveBeenCalledWith({
      where: { clientId: 'c1', status: { in: ['active', 'overdue'] } },
    });
  });

  it('anonymises identity, disables the user and kills live sessions', async () => {
    const { service, prisma, audit } = setup();

    const res = await service.requestDeletion('c1');

    expect(res).toEqual({ accepted: true, anonymized: true });

    const clientData = callData(prisma.client.update);
    expect(clientData['firstName']).toBe('Deleted');
    expect(clientData['nrcEncrypted']).toBe('');
    expect(clientData['dob']).toBeNull();
    expect(clientData['address']).toBeNull();
    expect(clientData['status']).toBe('blocked');
    // Frees the real number so the person can register again.
    expect(clientData['phone']).toBe('deleted:c1');
    // nrcHash is deliberately NOT part of the update (dedupe tombstone holds).
    expect(clientData).not.toHaveProperty('nrcHash');

    expect(callData(prisma.user.update)).toEqual({
      status: 'disabled',
      displayName: 'Deleted user',
      phone: 'deleted:u1',
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dpa.delete_request' }),
    );
  });

  it('skips user teardown when the client has no login', async () => {
    const { service, prisma } = setup({ client: { id: 'c1', user: null } });

    await service.requestDeletion('c1');

    expect(prisma.client.update).toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('404s for an unknown client', async () => {
    const { service } = setup({ client: null });

    await expect(service.requestDeletion('nope')).rejects.toThrow(/not found/i);
  });
});

describe('ComplianceService.exportMyData', () => {
  const client = {
    id: 'c1',
    firstName: 'Mwansa',
    lastName: 'Bwalya',
    phone: '+260971112233',
    dob: null,
    address: 'Chilenje',
    status: 'active',
    nrcEncrypted: 'enc(245711/63/1)',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    lenderLinks: [
      { createdAt: new Date('2026-02-01T00:00:00Z'), tenant: { id: 't1', name: 'Chilenje SACCO' } },
    ],
    loans: [
      {
        id: 'L1',
        principal: 40_000n,
        totalDue: 48_000n,
        paidAmount: 12_000n,
        status: 'active',
        disbursedAt: new Date('2026-03-01T00:00:00Z'),
        tenant: { name: 'Chilenje SACCO' },
        installments: [
          { seq: 1, dueDate: new Date('2026-04-12T00:00:00Z'), amount: 16_000n, paidAmount: 12_000n, status: 'pending', paidAt: null },
        ],
        repayments: [
          { amount: 12_000n, method: 'cash', reference: null, createdAt: new Date('2026-04-01T00:00:00Z') },
        ],
      },
    ],
    requests: [
      {
        id: 'R1',
        amount: 40_000n,
        termCount: 3,
        purpose: 'Stock',
        status: 'approved',
        feedback: null,
        createdAt: new Date('2026-02-20T00:00:00Z'),
        tenant: { name: 'Chilenje SACCO' },
      },
    ],
    creditChecks: [],
  };

  it('includes the subject’s own decrypted NRC', async () => {
    const { service, nrc } = setup({ client });

    const res = await service.exportMyData('c1');

    expect(res.profile.nrc).toBe('245711/63/1');
    expect(nrc.decrypt).toHaveBeenCalledWith('enc(245711/63/1)');
  });

  it('carries loans, repayments and lender names through', async () => {
    const { service } = setup({ client });

    const res = await service.exportMyData('c1');

    expect(res.format).toBe('kumvwa.dpa-export.v1');
    expect(res.lenders).toHaveLength(1);
    expect(res.lenders[0]?.id).toBe('t1');
    expect(res.lenders[0]?.name).toBe('Chilenje SACCO');
    expect(res.lenders[0]?.linkedAt).toBeInstanceOf(Date);
    expect(res.loans[0]?.lenderName).toBe('Chilenje SACCO');
    expect(res.loans[0]?.principalMinor).toBe('40000');
    expect(res.loans[0]?.repayments[0]?.amountMinor).toBe('12000');
    expect(res.loanRequests[0]?.lenderName).toBe('Chilenje SACCO');
  });

  it('audits the export as a pii read', async () => {
    const { service, audit } = setup({ client });

    await service.exportMyData('c1');

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pii.export', actorId: 'c1' }),
    );
  });

  it('returns a null NRC for an already-anonymised record', async () => {
    const { service, nrc } = setup({
      client: { ...client, nrcEncrypted: '' },
    });

    const res = await service.exportMyData('c1');

    expect(res.profile.nrc).toBeNull();
    expect(nrc.decrypt).not.toHaveBeenCalled();
  });
});
