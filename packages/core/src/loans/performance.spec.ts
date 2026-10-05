import { combinePerformance, repaymentPerformance } from './performance';

const TODAY = new Date('2026-06-15T00:00:00.000Z');
const due = (d: string) => new Date(`${d}T00:00:00.000Z`);
const at = (d: string) => new Date(`${d}T12:00:00.000Z`);

describe('repaymentPerformance', () => {
  it('counts on-time, late and currently-overdue installments', () => {
    const perf = repaymentPerformance(
      [
        // paid on the day it was due -> on time
        { seq: 1, dueDate: due('2026-01-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-01-01') },
        // paid a day early -> on time
        { seq: 2, dueDate: due('2026-02-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-01-31') },
        // paid late -> late
        { seq: 3, dueDate: due('2026-03-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-03-05') },
        // unpaid and past due -> overdueNow
        { seq: 4, dueDate: due('2026-05-01'), amountMinor: 100n, paidAmountMinor: 0n, paidAt: null },
        // unpaid, not yet due -> excluded from the rate
        { seq: 5, dueDate: due('2026-07-01'), amountMinor: 100n, paidAmountMinor: 0n, paidAt: null },
      ],
      5,
      TODAY,
    );
    expect(perf).toMatchObject({ onTime: 2, late: 1, overdueNow: 1, settled: 3 });
    // judged = 2 on-time + 1 late + 1 overdue = 4 -> 50%
    expect(perf.onTimeRate).toBe(50);
    expect(perf.hasHistory).toBe(true);
  });

  it('ignores rollover extension rows beyond the original term', () => {
    const perf = repaymentPerformance(
      [
        { seq: 1, dueDate: due('2026-01-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-01-01') },
        // appended rollover fee, born paid, in the future: must not flatter
        { seq: 2, dueDate: due('2027-01-01'), amountMinor: 500n, paidAmountMinor: 500n, paidAt: at('2026-06-01') },
      ],
      1,
      TODAY,
    );
    expect(perf.settled).toBe(1);
    expect(perf.onTimeRate).toBe(100);
  });

  it('reports no history when nothing has fallen due yet', () => {
    const perf = repaymentPerformance(
      [{ seq: 1, dueDate: due('2027-01-01'), amountMinor: 100n, paidAmountMinor: 0n, paidAt: null }],
      1,
      TODAY,
    );
    expect(perf.hasHistory).toBe(false);
    expect(perf.onTimeRate).toBe(0);
  });

  it('requires penalty to be settled before calling an installment paid', () => {
    const perf = repaymentPerformance(
      [{ seq: 1, dueDate: due('2026-01-01'), amountMinor: 100n, penaltyMinor: 10n, paidAmountMinor: 100n, paidAt: at('2026-01-01') }],
      1,
      TODAY,
    );
    expect(perf.settled).toBe(0);
    expect(perf.overdueNow).toBe(1);
  });
});

describe('combinePerformance', () => {
  it('adds counts and re-derives the rate from merged counts', () => {
    const a = repaymentPerformance(
      [
        { seq: 1, dueDate: due('2026-01-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-01-01') },
        { seq: 2, dueDate: due('2026-02-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-02-10') },
      ],
      2,
      TODAY,
    );
    const b = repaymentPerformance(
      [
        { seq: 1, dueDate: due('2026-03-01'), amountMinor: 100n, paidAmountMinor: 100n, paidAt: at('2026-03-01') },
      ],
      1,
      TODAY,
    );
    const merged = combinePerformance([a, b]);
    expect(merged).toMatchObject({ onTime: 2, late: 1, settled: 3 });
    expect(merged.onTimeRate).toBe(66.7);
  });
});
