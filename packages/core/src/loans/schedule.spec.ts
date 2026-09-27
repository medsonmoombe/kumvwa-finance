import {
  addMonthsUtc,
  buildSchedule,
  firstDueDateFrom,
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

  it('dates the first payment one period after the loan is drawn down', () => {
    // Drawn on the 27th → first payment due a full month later, not on a fixed
    // day of the month that would silently shorten a 1-month term.
    expect(
      firstDueDateFrom(new Date('2026-09-27T11:22:06Z')).toISOString().slice(0, 10),
    ).toBe('2026-10-27');
    // December wraps into the next year.
    expect(
      firstDueDateFrom(new Date('2026-12-20T08:00:00Z')).toISOString().slice(0, 10),
    ).toBe('2027-01-20');
  });

  it('anchors the schedule to the ZAMBIAN date of drawdown', () => {
    // 23:30 UTC on the 27th is already the 28th in Lusaka, so the 1-month term
    // must mature on the 28th, not the 27th.
    expect(
      firstDueDateFrom(new Date('2026-09-27T23:30:00Z')).toISOString().slice(0, 10),
    ).toBe('2026-10-28');
    // ...and 21:00 UTC is still the 27th locally.
    expect(
      firstDueDateFrom(new Date('2026-09-27T21:00:00Z')).toISOString().slice(0, 10),
    ).toBe('2026-10-27');
  });

  it('clamps a month-end drawdown without skipping the term', () => {
    // 31 Jan + 1 month = 28 Feb, which is still a real one-month term.
    expect(
      firstDueDateFrom(new Date('2026-01-31T09:00:00Z')).toISOString().slice(0, 10),
    ).toBe('2026-02-28');
  });

  it('spaces weekly and fortnightly first payments by whole days', () => {
    expect(
      firstDueDateFrom(new Date('2026-09-27T09:00:00Z'), 'weekly')
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-10-04');
    expect(
      firstDueDateFrom(new Date('2026-09-27T09:00:00Z'), 'fortnightly')
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-10-11');
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

describe('buildSchedule — bullet', () => {
  const first = new Date(Date.UTC(2026, 8, 12));

  it('3 months → ONE installment at maturity, amount = full total', () => {
    const s = buildSchedule({
      principalMinor: 45_500n, // K455
      rateBps: 2500, // flat 25% for the term
      termCount: 3,
      firstDueDate: first,
      structure: 'bullet',
    });

    expect(s.installments).toHaveLength(1);
    const [inst] = s.installments;
    expect(inst!.seq).toBe(1);
    expect(inst!.amountMinor).toBe(s.totalDueMinor);
    expect(inst!.amountMinor).toBe(56_875n); // K455 × 1.25 = K568.75
    // Maturity = the date the LAST installment would have had (first + 2mo).
    expect(inst!.dueDate).toEqual(new Date(Date.UTC(2026, 10, 12)));
    expect(s.feeMinor).toBe(0n);
    // Reconciliation invariant: Σ schedule === totalDue.
    const sum = s.installments.reduce((a, i) => a + i.amountMinor, 0n);
    expect(sum).toBe(s.totalDueMinor);
  });

  it('folds an origination fee into the single installment', () => {
    const s = buildSchedule({
      principalMinor: 100_000n,
      rateBps: 1000,
      termCount: 1,
      firstDueDate: first,
      feeMinor: 5_000n,
      structure: 'bullet',
    });
    expect(s.totalDueMinor).toBe(115_000n); // 100k × 1.10 + 5k fee
    expect(s.feeMinor).toBe(5_000n);
    expect(s.installments[0]!.amountMinor).toBe(s.totalDueMinor);
  });

  it('rejects terms outside 1..36 months for bullet', () => {
    expect(() =>
      buildSchedule({
        principalMinor: 100n,
        rateBps: 100,
        termCount: 0,
        firstDueDate: first,
        structure: 'bullet',
      }),
    ).toThrow();
    expect(() =>
      buildSchedule({
        principalMinor: 100n,
        rateBps: 100,
        termCount: 37,
        firstDueDate: first,
        structure: 'bullet',
      }),
    ).toThrow();
  });

  it('omitting structure keeps the installment schedule (no behavior change)', () => {
    const s = buildSchedule({
      principalMinor: 45_500n,
      rateBps: 2500,
      termCount: 3,
      firstDueDate: first,
    });
    expect(s.installments).toHaveLength(3);
  });
});

describe('a term means the number of months the borrower was promised', () => {
  const drawnDown = new Date('2026-09-27T11:22:06Z'); // the reported loan
  const date = (d: Date) => d.toISOString().slice(0, 10);

  it('matures a 1-month bullet one calendar month after drawdown', () => {
    // Regression: anchoring the schedule to a fixed day-of-month made a
    // 1-month term drawn on the 27th mature on the 12th of the next month —
    // 15 days instead of 30.
    const s = buildSchedule({
      principalMinor: 100_000n,
      rateBps: 1000,
      termCount: 1,
      firstDueDate: firstDueDateFrom(drawnDown),
      structure: 'bullet',
    });
    expect(date(s.installments[0]!.dueDate)).toBe('2026-10-27');
  });

  it.each([1, 2, 3, 6, 12])(
    'puts the final installment exactly %i month(s) after drawdown',
    (months) => {
      const anchor = firstDueDateFrom(drawnDown);
      const bullet = buildSchedule({
        principalMinor: 100_000n,
        rateBps: 1000,
        termCount: months,
        firstDueDate: anchor,
        structure: 'bullet',
      });
      const amortizing = buildSchedule({
        principalMinor: 100_000n,
        rateBps: 1000,
        termCount: months,
        firstDueDate: anchor,
      });
      const addMonths = (d: Date, n: number) => addMonthsUtc(d, n);

      expect(date(bullet.installments[0]!.dueDate)).toBe(
        date(addMonths(anchor, months - 1)),
      );
      const last = amortizing.installments.at(-1)!;
      expect(date(last.dueDate)).toBe(date(addMonths(anchor, months - 1)));
    },
  );

  it('never matures a loan before it was drawn down', () => {
    for (const months of [1, 2, 3, 4, 6, 12]) {
      const s = buildSchedule({
        principalMinor: 100_000n,
        rateBps: 1000,
        termCount: months,
        firstDueDate: firstDueDateFrom(drawnDown),
        structure: 'bullet',
      });
      expect(s.installments[0]!.dueDate.getTime()).toBeGreaterThan(
        drawnDown.getTime(),
      );
    }
  });
});
