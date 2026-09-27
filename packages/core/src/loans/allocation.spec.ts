import fc from 'fast-check';

import { allocateRepayment, type AllocatableInstallment } from './allocation';

const inst = (
  id: string,
  seq: number,
  amountMinor: bigint,
  paidAmountMinor = 0n,
  status: AllocatableInstallment['status'] = 'pending',
  penaltyMinor: bigint = 0n,
): AllocatableInstallment => ({
  id,
  seq,
  amountMinor,
  paidAmountMinor,
  status,
  penaltyMinor,
});

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

  it('settlement includes the accrued penalty', () => {
    // K100 installment + K20 penalty: a K100 payment does NOT settle it.
    const res = allocateRepayment(10_000n, [inst('a', 1, 10_000n, 0n, 'overdue', 2_000n)]);
    expect(res.changes[0]?.settled).toBe(false);
    expect(res.changes[0]?.status).toBe('overdue');
    // Paying the remaining K10 clears amount + penalty.
    const res2 = allocateRepayment(10_000n, [
      inst('a', 1, 10_000n, 10_000n, 'overdue', 2_000n),
    ]);
    expect(res2.changes[0]?.settled).toBe(true);
    expect(res2.changes[0]?.status).toBe('paid');
    expect(res2.changes[0]?.paidAmountMinor).toBe(12_000n);
  });

  it('PROPERTY: applied = min(payment, Σ(amount + penalty − paid))⁺, conservation holds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 6 }), // installment count
        fc.bigInt({ min: 1n, max: 500_000n }), // amount each
        fc.bigInt({ min: 0n, max: 100_000n }), // penalty each
        fc.bigInt({ min: 0n, max: 400_000n }), // already paid each
        fc.bigInt({ min: 1n, max: 3_000_000n }), // payment
        (count, amount, penalty, paid0, payment) => {
          const rows: AllocatableInstallment[] = Array.from(
            { length: count },
            (_, i) =>
              inst(`i${i}`, i + 1, amount, paid0 > amount ? amount : paid0, 'pending', penalty),
          );
          const owedTotal = rows.reduce(
            (a, r) =>
              a +
              (r.amountMinor + (r.penaltyMinor ?? 0n) - r.paidAmountMinor > 0n
                ? r.amountMinor + (r.penaltyMinor ?? 0n) - r.paidAmountMinor
                : 0n),
            0n,
          );
          const res = allocateRepayment(payment, rows);
          const expectedApplied =
            payment < owedTotal ? payment : owedTotal;
          if (res.appliedMinor !== expectedApplied) return false;
          if (res.appliedMinor + res.unappliedMinor !== payment) return false;
          // Conservation: Σ paid after = Σ paid before + applied.
          const sumPaidAfter = rows.reduce((a, r) => a + r.paidAmountMinor, 0n);
          const sumPaidBefore = rows.reduce(
            (a, r) =>
              a + (r.paidAmountMinor > r.amountMinor + (r.penaltyMinor ?? 0n)
                ? r.amountMinor + (r.penaltyMinor ?? 0n)
                : r.paidAmountMinor),
            0n,
          );
          // (rows were not mutated, so recompute from changes for after-sum)
          const paidFromChanges = new Map(
            res.changes.map((c) => [c.id, c.paidAmountMinor] as const),
          );
          const totalAfter = rows.reduce(
            (a, r) => a + (paidFromChanges.get(r.id) ?? r.paidAmountMinor),
            0n,
          );
          return totalAfter - sumPaidBefore === res.appliedMinor;
        },
      ),
      { numRuns: 1000 },
    );
  });
});
