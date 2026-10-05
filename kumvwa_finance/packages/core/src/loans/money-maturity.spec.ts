import fc from 'fast-check';

import {
  addFrequency,
  buildSchedule,
  type Frequency,
} from './schedule';
import { originationFee } from './fees';
import { nextPenalty, penaltyCap } from './penalties';
import {
  rolloverPlan,
  rolloverBulletPlan,
  type RolloverInstallment,
} from './rollover';

const DAY = 86_400_000;

describe('frequency schedules', () => {
  it('weekly: 8 installments 7 days apart', () => {
    const s = buildSchedule({
      principalMinor: 400000n,
      rateBps: 1500,
      termCount: 8,
      firstDueDate: new Date(Date.UTC(2025, 7, 2)), // Saturday
      frequency: 'weekly',
    });
    expect(s.installments).toHaveLength(8);
    expect(
      s.installments[1]!.dueDate.getTime() -
        s.installments[0]!.dueDate.getTime(),
    ).toBe(7 * DAY);
    const sum = s.installments.reduce((a, i) => a + i.amountMinor, 0n);
    expect(sum).toBe(s.totalDueMinor);
  });

  it('fortnightly: 4 installments 14 days apart', () => {
    const s = buildSchedule({
      principalMinor: 200000n,
      rateBps: 1000,
      termCount: 4,
      firstDueDate: new Date(Date.UTC(2025, 7, 1)),
      frequency: 'fortnightly',
    });
    expect(
      s.installments[3]!.dueDate.getTime() -
        s.installments[0]!.dueDate.getTime(),
    ).toBe(42 * DAY);
  });

  it('monthly default is unchanged (clamped month math)', () => {
    const s = buildSchedule({
      principalMinor: 50000n,
      rateBps: 1200,
      termCount: 3,
      firstDueDate: new Date(Date.UTC(2026, 0, 31)),
    });
    expect(s.installments.map((i) => i.dueDate.toISOString().slice(0, 10)))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('PROPERTY: any frequency × terms — Σ installments = principal + interest + fee', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Frequency>('monthly', 'weekly', 'fortnightly'),
        fc.integer({ min: 10000, max: 1_000_000 }), // principal in ngwee
        fc.integer({ min: 0, max: 5000 }), // rateBps
        fc.integer({ min: 1, max: 24 }), // termCount
        fc.integer({ min: 0, max: 200000 }), // fee
        (frequency, principal, rateBps, termCount, fee) => {
          const s = buildSchedule({
            principalMinor: BigInt(principal),
            rateBps,
            termCount,
            firstDueDate: new Date(Date.UTC(2025, 7, 12)),
            frequency,
            feeMinor: BigInt(fee),
          });
          const sum = s.installments.reduce((a, i) => a + i.amountMinor, 0n);
          return (
            sum === s.totalDueMinor &&
            s.totalDueMinor ===
              BigInt(principal) +
                ((BigInt(principal) * BigInt(10000 + rateBps) + 5000n) /
                  10000n -
                  BigInt(principal)) +
                BigInt(fee) &&
            s.installments.every(
              (i, idx) =>
                i.seq === idx + 1 &&
                i.dueDate.getTime() >=
                  s.installments[Math.max(0, idx - 1)]!.dueDate.getTime(),
            )
          );
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('origination fees', () => {
  it('add: full disbursement, fee in total due', () => {
    const f = originationFee(400000n, 500, 'add'); // 5% of K4,000 = K200
    expect(f.feeMinor).toBe(20000n);
    expect(f.disbursementMinor).toBe(400000n);
    const s = buildSchedule({
      principalMinor: 400000n,
      rateBps: 1500,
      termCount: 3,
      firstDueDate: new Date(Date.UTC(2025, 7, 12)),
      feeMinor: f.feeMinor,
    });
    expect(s.totalDueMinor).toBe(480000n); // 4,000 + 600 + 200
  });

  it('deduct: net disbursement, same total due', () => {
    const f = originationFee(400000n, 500, 'deduct');
    expect(f.disbursementMinor).toBe(380000n);
  });

  it('rejects fee above 20% and non-integers', () => {
    expect(() => originationFee(100000n, 2500, 'add')).toThrow();
    expect(() => originationFee(100000n, 12.5, 'add')).toThrow();
    expect(() => originationFee(100000n, -1, 'add')).toThrow();
  });
});

describe('penalties', () => {
  it('accrues daily and respects the cap', () => {
    const terms = { bpsPerDay: 50, capBps: 2000 }; // 0.5%/day, cap 20%
    const unpaid = 100000n; // K1,000 installment
    let current = 0n;
    for (let d = 0; d < 60; d++) {
      current += nextPenalty({
        currentMinor: current,
        unpaidMinor: unpaid,
        installmentAmountMinor: unpaid,
        terms,
      });
    }
    expect(current).toBe(penaltyCap(unpaid, 2000)); // capped at K200
    expect(current).toBe(20000n);
  });

  it('zero-rate products never accrue', () => {
    expect(
      nextPenalty({
        currentMinor: 0n,
        unpaidMinor: 100000n,
        installmentAmountMinor: 100000n,
        terms: { bpsPerDay: 0, capBps: 2000 },
      }),
    ).toBe(0n);
  });

  it('PROPERTY: penalty never exceeds the cap and never decreases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000000 }), // installment amount
        fc.integer({ min: 0, max: 100 }), // paid fraction %
        fc.integer({ min: 1, max: 500 }), // bpsPerDay
        fc.integer({ min: 0, max: 5000 }), // capBps
        fc.integer({ min: 1, max: 120 }), // days
        (amount, paidPct, bpsPerDay, capBps, days) => {
          const terms = { bpsPerDay, capBps };
          const unpaid =
            BigInt(amount) - (BigInt(amount) * BigInt(paidPct)) / 100n;
          let current = 0n;
          let prev = 0n;
          for (let d = 0; d < days; d++) {
            current += nextPenalty({
              currentMinor: current,
              unpaidMinor: unpaid,
              installmentAmountMinor: BigInt(amount),
              terms,
            });
            if (current < prev) return false;
            prev = current;
          }
          return current <= penaltyCap(BigInt(amount), capBps);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('rolloverPlan', () => {
  // Interest is spread proportionally across the three installments below.
  const interest = 46_000n;
  const principal = 400_000n;
  const mk = (): RolloverInstallment[] => [
    {
      seq: 1,
      dueDate: new Date(Date.UTC(2025, 7, 12)),
      amountMinor: 153333n,
      paidAmountMinor: 0n,
      interestMinor: (interest * 153333n) / 460_000n,
    },
    {
      seq: 2,
      dueDate: new Date(Date.UTC(2025, 8, 12)),
      amountMinor: 153333n,
      paidAmountMinor: 0n,
      interestMinor: (interest * 153333n) / 460_000n,
    },
    {
      seq: 3,
      dueDate: new Date(Date.UTC(2025, 9, 12)),
      amountMinor: 153334n,
      paidAmountMinor: 0n,
      interestMinor:
        interest -
        (interest * 153333n) / 460_000n -
        (interest * 153333n) / 460_000n,
    },
  ];

  it('shifts unpaid and does not append a new installment', () => {
    const p = rolloverPlan({
      installments: mk(),
      principalMinor: principal,
      rolloverCount: 0,
      maxRollovers: 2,
    });
    expect('appended' in p).toBe(false);
    expect(p.shifts).toHaveLength(3);
    expect(p.shifts[0]!.newDueDate).toEqual(new Date(Date.UTC(2025, 8, 12)));
    expect(p.newTotalDueMinor).toBe(460_000n + interest);
  });

  it('settled installments do not shift', () => {
    const insts = mk();
    insts[0]!.paidAmountMinor = insts[0]!.amountMinor;
    const p = rolloverPlan({
      installments: insts,
      principalMinor: principal,
      rolloverCount: 0,
      maxRollovers: 2,
    });
    expect(p.shifts.map((s) => s.seq)).toEqual([2, 3]);
  });

  it('enforces the cap', () => {
    expect(() =>
      rolloverPlan({
        installments: mk(),
        principalMinor: principal,
        rolloverCount: 2,
        maxRollovers: 2,
      }),
    ).toThrow(/no further extensions/i);
  });

  it('rejects a loan with no remaining interest and a fully-paid loan', () => {
    const paid = mk().map((i) => ({
      ...i,
      paidAmountMinor: i.amountMinor,
    }));
    expect(() =>
      rolloverPlan({
        installments: paid,
        principalMinor: principal,
        rolloverCount: 0,
        maxRollovers: 2,
      }),
    ).toThrow(/no interest remains/i);
  });

  it('PROPERTY: after N extensions Σ = original Σ + N×fee; dates strictly increasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 }),
        fc.bigInt({ min: 10000n, max: 100000n }),
        (n, principalMinor) => {
          const interestMinor = principalMinor;
          const per = principalMinor / 3n;
          const insts: RolloverInstallment[] = [
            {
              seq: 1,
              dueDate: new Date(Date.UTC(2025, 7, 12)),
              amountMinor: per,
              paidAmountMinor: 0n,
              interestMinor: interestMinor / 3n,
            },
            {
              seq: 2,
              dueDate: new Date(Date.UTC(2025, 8, 12)),
              amountMinor: per,
              paidAmountMinor: 0n,
              interestMinor: interestMinor / 3n,
            },
            {
              seq: 3,
              dueDate: new Date(Date.UTC(2025, 9, 12)),
              amountMinor: principalMinor - per * 2n,
              paidAmountMinor: 0n,
              interestMinor: interestMinor - (interestMinor / 3n) * 2n,
            },
          ];
          let sum = insts.reduce((a, i) => a + i.amountMinor, 0n);
          for (let k = 0; k < n; k++) {
            const p = rolloverPlan({
              installments: insts,
              principalMinor,
              rolloverCount: k,
              maxRollovers: 5,
            });
            if ('appended' in p) return false;
            insts = insts.map((i) => ({
              ...i,
              dueDate: p.shifts.find((s) => s.seq === i.seq)!.newDueDate,
            }));
            sum += p.extensionFeeMinor;
            const newSum = insts.reduce((a, i) => a + i.amountMinor, 0n);
            if (newSum !== sum) return false;
            for (let x = 1; x < insts.length; x++) {
              if (insts[x]!.dueDate <= insts[x - 1]!.dueDate) return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 300 },
    );
  });

  describe('rolloverBulletPlan (bullet loans)', () => {
    const base = {
      dueDate: new Date(Date.UTC(2026, 0, 12)),
      amountMinor: 56_875n,
      paidAmountMinor: 20_000n,
      interestMinor: 10_000n,
      rolloverCount: 0,
      maxRollovers: 2,
      principalMinor: 50_000n,
    };

    it('pays the remaining-interest fee, moves maturity +1 month, grows totalDue by the fee', () => {
      const p = rolloverBulletPlan(base);
      expect(p.paymentMinor).toBe(base.interestMinor);
      expect(p.newDueDate).toEqual(new Date(Date.UTC(2026, 1, 12)));
      expect(p.amountIncreaseMinor).toBe(base.interestMinor);
      expect(p.newTotalDueMinor).toBe(base.amountMinor + base.interestMinor);
    });

    it('enforces the rollover cap', () => {
      expect(() =>
        rolloverBulletPlan({
          ...base,
          rolloverCount: 2,
        }),
      ).toThrow(/no further extensions/i);
    });

    it('refuses a cleared installment and a loan with no remaining interest', () => {
      expect(() =>
        rolloverBulletPlan({
          ...base,
          paidAmountMinor: base.amountMinor,
        }),
      ).toThrow(/fully repaid/i);
      expect(() =>
        rolloverBulletPlan({
          ...base,
          interestMinor: 0n,
        }),
      ).toThrow(/no interest remains/i);
    });

    it('PROPERTY: outstanding is unchanged by the extension itself', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1_000n, max: 1_000_000n }),
          fc.bigInt({ min: 0n, max: 999_999n }),
          fc.bigInt({ min: 1n, max: 50_000n }),
          (amount, paidRaw, interestMinor) => {
            const paid = paidRaw % amount;
            const outstandingBefore = amount - paid;
            const p = rolloverBulletPlan({
              dueDate: new Date(Date.UTC(2026, 0, 12)),
              amountMinor: amount,
              paidAmountMinor: paid,
              interestMinor,
              rolloverCount: 0,
              maxRollovers: 5,
              principalMinor: amount - interestMinor,
            });
            const outstandingAfter =
              p.newTotalDueMinor - (paid + p.paymentMinor);
            return outstandingAfter === outstandingBefore;
          },
        ),
        { numRuns: 300 },
      );
    });
  });
});
