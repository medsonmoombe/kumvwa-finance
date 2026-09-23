import {
  addMonthsUtc,
  buildSchedule,
  firstDueDateUtc,
  totalDueMinor,
} from './schedule';

describe('loan schedule', () => {
  const first = new Date(Date.UTC(2026, 2, 12)); // 12 Mar 2026

  it('applies flat interest with integer rounding', () => {
    // 800.00 kwacha @ 15% = 920.00
    expect(totalDueMinor(80000n, 1500)).toBe(92000n);
    expect(totalDueMinor(10000n, 0)).toBe(10000n);
  });

  it('splits installments and the last one absorbs the remainder', () => {
    const s = buildSchedule({
      principalMinor: 80000n,
      rateBps: 1500,
      termCount: 3,
      firstDueDate: first,
    });
    expect(s.totalDueMinor).toBe(92000n);
    expect(s.installments.map((i) => i.amountMinor)).toEqual([
      30666n,
      30666n,
      30668n,
    ]);
    // Invariant: installments always sum exactly to the total.
    const sum = s.installments.reduce((a, i) => a + i.amountMinor, 0n);
    expect(sum).toBe(s.totalDueMinor);
  });

  it('numbers installments from 1 and spaces them monthly', () => {
    const s = buildSchedule({
      principalMinor: 50000n,
      rateBps: 1200,
      termCount: 3,
      firstDueDate: first,
    });
    expect(s.installments.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(s.installments.map((i) => i.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-03-12',
      '2026-04-12',
      '2026-05-12',
    ]);
  });

  it('never rolls over short months', () => {
    expect(
      addMonthsUtc(new Date(Date.UTC(2026, 0, 31)), 1).toISOString().slice(0, 10),
    ).toBe('2026-02-28');
  });

  it('uses the 12th of next month as the platform due date', () => {
    expect(
      firstDueDateUtc(new Date(Date.UTC(2026, 1, 5))).toISOString().slice(0, 10),
    ).toBe('2026-03-12');
    // December wraps into the next year
    expect(
      firstDueDateUtc(new Date(Date.UTC(2026, 11, 20))).toISOString().slice(0, 10),
    ).toBe('2027-01-12');
  });

  it('rejects invalid input', () => {
    expect(() =>
      buildSchedule({
        principalMinor: 0n,
        rateBps: 1000,
        termCount: 1,
        firstDueDate: first,
      }),
    ).toThrow();
    expect(() =>
      buildSchedule({
        principalMinor: 100n,
        rateBps: 1000,
        termCount: 0,
        firstDueDate: first,
      }),
    ).toThrow();
  });
});
