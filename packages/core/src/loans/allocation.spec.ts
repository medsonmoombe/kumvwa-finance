import { allocateRepayment, type AllocatableInstallment } from './allocation';

const inst = (
  id: string,
  seq: number,
  amountMinor: bigint,
  paidAmountMinor = 0n,
  status: AllocatableInstallment['status'] = 'pending',
): AllocatableInstallment => ({ id, seq, amountMinor, paidAmountMinor, status });

describe('allocateRepayment', () => {
  it('fully settles a single installment paid exactly', () => {
    const res = allocateRepayment(10_000n, [inst('a', 1, 10_000n)]);

    expect(res.appliedMinor).toBe(10_000n);
    expect(res.unappliedMinor).toBe(0n);
    expect(res.changes).toEqual([
      { id: 'a', paidAmountMinor: 10_000n, status: 'paid', settled: true },
    ]);
  });

  it('leaves a partial payment unpaid and keeps the prior status', () => {
    const res = allocateRepayment(4_000n, [inst('a', 1, 10_000n, 0n, 'overdue')]);

    expect(res.appliedMinor).toBe(4_000n);
    expect(res.changes).toEqual([
      // NOT promoted to 'paid', and still flagged overdue.
      { id: 'a', paidAmountMinor: 4_000n, status: 'overdue', settled: false },
    ]);
  });

  it('spreads a payment across installments oldest-first', () => {
    const res = allocateRepayment(15_000n, [
      inst('a', 1, 10_000n),
      inst('b', 2, 10_000n),
      inst('c', 3, 10_000n),
    ]);

    expect(res.appliedMinor).toBe(15_000n);
    expect(res.changes).toEqual([
      { id: 'a', paidAmountMinor: 10_000n, status: 'paid', settled: true },
      { id: 'b', paidAmountMinor: 5_000n, status: 'pending', settled: false },
    ]);
  });

  it('skips installments that are already settled', () => {
    const res = allocateRepayment(10_000n, [
      inst('a', 1, 10_000n, 10_000n, 'paid'),
      inst('b', 2, 10_000n),
    ]);

    expect(res.changes).toEqual([
      { id: 'b', paidAmountMinor: 10_000n, status: 'paid', settled: true },
    ]);
  });

  it('tops up a half-paid installment before touching the next', () => {
    const res = allocateRepayment(10_000n, [
      inst('a', 1, 10_000n, 6_000n),
      inst('b', 2, 10_000n),
    ]);

    expect(res.changes).toEqual([
      { id: 'a', paidAmountMinor: 10_000n, status: 'paid', settled: true },
      { id: 'b', paidAmountMinor: 6_000n, status: 'pending', settled: false },
    ]);
  });

  it('orders by seq regardless of input order', () => {
    const res = allocateRepayment(10_000n, [
      inst('later', 3, 10_000n),
      inst('earlier', 1, 10_000n),
      inst('middle', 2, 10_000n),
    ]);

    expect(res.changes.map((c) => c.id)).toEqual(['earlier']);
  });

  it('reports a remainder when the payment exceeds what is owed', () => {
    const res = allocateRepayment(25_000n, [inst('a', 1, 10_000n)]);

    expect(res.appliedMinor).toBe(10_000n);
    expect(res.unappliedMinor).toBe(15_000n);
  });

  it('applies nothing when every installment is settled', () => {
    const res = allocateRepayment(5_000n, [
      inst('a', 1, 10_000n, 10_000n, 'paid'),
    ]);

    expect(res.changes).toEqual([]);
    expect(res.appliedMinor).toBe(0n);
    expect(res.unappliedMinor).toBe(5_000n);
  });

  it('rejects non-positive amounts', () => {
    expect(() => allocateRepayment(0n, [inst('a', 1, 10_000n)])).toThrow(
      /positive/,
    );
    expect(() => allocateRepayment(-100n, [inst('a', 1, 10_000n)])).toThrow(
      /positive/,
    );
  });

  it('does not mutate the caller’s installments', () => {
    const rows = [inst('a', 1, 10_000n, 2_000n)];
    allocateRepayment(5_000n, rows);

    expect(rows[0]?.paidAmountMinor).toBe(2_000n);
    expect(rows[0]?.status).toBe('pending');
  });
});
