import {
  asAudit,
  asNotify,
  asPrisma,
  auditMock,
  callArg,
  callData,
  notifyMock,
} from '../../testing/mocks';
import { LoansService } from './loans.service';

const defaultLoan = {
  id: 'L1',
  tenantId: 't1',
  clientId: 'c1',
  totalDue: 30_000n,
  paidAmount: 0n,
  status: 'active',
};

const defaultInstallments = [
  { id: 'i1', seq: 1, amount: 10_000n, paidAmount: 0n, status: 'pending' },
  { id: 'i2', seq: 2, amount: 10_000n, paidAmount: 0n, status: 'pending' },
  { id: 'i3', seq: 3, amount: 10_000n, paidAmount: 0n, status: 'pending' },
];

function setup(
  overrides: {
    existing?: Record<string, unknown> | null;
    loan?: Record<string, unknown>;
    installments?: Record<string, unknown>[];
  } = {},
) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    loan: {
      findUnique: jest.fn().mockResolvedValue(overrides.loan ?? defaultLoan),
      update: jest.fn().mockResolvedValue({}),
    },
    installment: {
      findMany: jest
        .fn()
        .mockResolvedValue(overrides.installments ?? defaultInstallments),
      update: jest.fn().mockResolvedValue({}),
    },
    repayment: { create: jest.fn().mockResolvedValue({ id: 'rep1' }) },
  };

  const prisma = {
    repayment: {
      findUnique: jest.fn().mockResolvedValue(overrides.existing ?? null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'rep1',
        amount: 10_000n,
        method: 'cash',
        reference: null,
        createdAt: new Date('2026-09-22T00:00:00Z'),
      }),
    },
    loan: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'L1',
        status: 'active',
        totalDue: 30_000n,
        paidAmount: 10_000n,
      }),
    },
    installment: { findFirst: jest.fn().mockResolvedValue(null) },
    user: { findFirst: jest.fn().mockResolvedValue({ id: 'u1' }) },
    $transaction: jest.fn((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
  };

  const audit = auditMock();
  const notify = notifyMock();
  const service = new LoansService(
    asPrisma(prisma),
    asAudit(audit),
    asNotify(notify),
  );

  return { service, prisma, tx, audit, notify };
}

const dto = { amount: 100, method: 'cash' as const };

describe('LoansService.recordRepayment — idempotency', () => {
  it('replays a repeated Idempotency-Key instead of double-crediting', async () => {
    const { service, prisma, tx } = setup({
      existing: { id: 'rep1', loanId: 'L1' },
    });

    const res = await service.recordRepayment(
      't1',
      'u1',
      'L1',
      dto,
      'key-1',
    );

    expect(res.replayed).toBe(true);
    expect(res.id).toBe('rep1');
    expect(tx.repayment.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a key that was already used for a different loan', async () => {
    const { service } = setup({
      existing: { id: 'rep1', loanId: 'SOMETHING_ELSE' },
    });

    await expect(
      service.recordRepayment('t1', 'u1', 'L1', dto, 'key-1'),
    ).rejects.toThrow(/reused for another loan/);
  });

  it('mints a key when the header is absent, so retries still dedupe', async () => {
    const { service, tx } = setup();

    await service.recordRepayment('t1', 'u1', 'L1', dto);

    const data = callData(tx.repayment.create);
    expect(typeof data['idempotencyKey']).toBe('string');
    expect((data['idempotencyKey'] as string).length).toBeGreaterThan(10);
  });
});

describe('LoansService.recordRepayment — allocation', () => {
  it('settles the oldest installment first', async () => {
    const { service, tx } = setup();

    await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    expect(
      callArg<{ where: { id: string } }>(tx.installment.update)?.where,
    ).toEqual({ id: 'i1' });
    const first = callData(tx.installment.update);
    expect(first['paidAmount']).toBe(10_000n);
    expect(first['status']).toBe('paid');
    expect(first['paidAt']).toBeInstanceOf(Date);
  });

  it('spreads a partial payment and leaves the status alone', async () => {
    const { service, tx } = setup();

    await service.recordRepayment(
      't1',
      'u1',
      'L1',
      { amount: 150, method: 'cash' },
      'k1',
    );

    expect(tx.installment.update).toHaveBeenCalledTimes(2);
    expect(
      callArg<{ where: { id: string } }>(tx.installment.update, 1)?.where,
    ).toEqual({ id: 'i2' });
    const second = callData(tx.installment.update, 1);
    expect(second['paidAmount']).toBe(5_000n);
    expect(second['status']).toBe('pending');
  });

  it('advances the loan without clearing it', async () => {
    const { service, tx } = setup();

    await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    const data = callData(tx.loan.update);
    expect(data['paidAmount']).toBe(10_000n);
    expect(data['status']).toBe('active');
  });

  it('clears the loan when the payment settles it in full', async () => {
    const { service, tx, notify } = setup({
      loan: { ...defaultLoan, totalDue: 10_000n },
      installments: [
        { id: 'i1', seq: 1, amount: 10_000n, paidAmount: 0n, status: 'pending' },
      ],
    });

    await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    const data = callData(tx.loan.update);
    expect(data['status']).toBe('cleared');
    expect(callArg(notify.create, 0, 3)).toMatch(/fully repaid/);
  });

  it('locks the loan row before reading it', async () => {
    const { service, tx } = setup();

    await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    expect(tx.$queryRaw).toHaveBeenCalled();
  });
});

describe('LoansService.recordRepayment — guards', () => {
  it('refuses a payment above the outstanding balance', async () => {
    const { service, tx } = setup();

    await expect(
      service.recordRepayment('t1', 'u1', 'L1', { amount: 400, method: 'cash' }, 'k1'),
    ).rejects.toThrow(/exceeds the outstanding balance/);
    expect(tx.repayment.create).not.toHaveBeenCalled();
  });

  it('refuses a loan that is already fully repaid', async () => {
    const { service } = setup({
      loan: { ...defaultLoan, paidAmount: 30_000n },
    });

    await expect(
      service.recordRepayment('t1', 'u1', 'L1', dto, 'k1'),
    ).rejects.toThrow(/already fully repaid/);
  });

  it('refuses a non-positive amount before touching the transaction', async () => {
    const { service, prisma } = setup();

    await expect(
      service.recordRepayment('t1', 'u1', 'L1', { amount: 0, method: 'cash' }, 'k1'),
    ).rejects.toThrow(/greater than zero/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("404s for a loan belonging to another tenant", async () => {
    const { service } = setup({
      loan: { ...defaultLoan, tenantId: 'someone-else' },
    });

    await expect(
      service.recordRepayment('t1', 'u1', 'L1', dto, 'k1'),
    ).rejects.toThrow(/not found/i);
  });
});

describe('LoansService.recordRepayment — receipt & side effects', () => {
  it('returns the receipt with the remaining outstanding balance', async () => {
    const { service } = setup();

    const res = await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    expect(res.replayed).toBe(false);
    expect(res.amountMinor).toBe('10000');
    // 30000 due - 10000 paid
    expect(res.loan.outstandingMinor).toBe('20000');
  });

  it('notifies the client and writes an audit entry', async () => {
    const { service, notify, audit } = setup();

    await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    expect(notify.create).toHaveBeenCalledWith(
      'u1',
      'payment_received',
      expect.any(String),
      expect.any(String),
      { loanId: 'L1' },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'loan.repayment', entityId: 'L1' }),
    );
  });

  it('skips the client notification when there is no client login', async () => {
    const { service, prisma, notify } = setup();
    prisma.user.findFirst.mockResolvedValue(null);

    await service.recordRepayment('t1', 'u1', 'L1', dto, 'k1');

    expect(notify.create).not.toHaveBeenCalled();
  });
});
