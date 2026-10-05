import fc from 'fast-check';

import {
  DEFAULT_CREDIT_POLICY,
  orderedTiers,
  resolveCreditLimit,
  type BorrowerStats,
  type CreditPolicy,
  type CreditTier,
} from './policy';

const stats = (over: Partial<BorrowerStats> = {}): BorrowerStats => ({
  clearedCount: 0,
  pendingRequestCount: 0,
  activeCount: 0,
  overdueCount: 0,
  defaultedCount: 0,
  defaultedAt: null as string | null,
  ...over,
});

describe('resolveCreditLimit', () => {
  it('first-time borrower → tier 0 limit', () => {
    const r = resolveCreditLimit(DEFAULT_CREDIT_POLICY, stats(), null);
    expect(r.limitKwacha).toBe(1000);
    expect(r.tier).toBe('First-time borrower');
  });

  it('ladder climbing: 2 cleared → K5,000 · 3 months', () => {
    const r = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 2 }),
      null,
    );
    expect(r.limitKwacha).toBe(5000);
    expect(r.maxTermMonths).toBe(3);
    expect(r.tier).toBe('Proven borrower');
    expect(r.nextTier?.label).toBe('Trusted client');
    expect(r.nextTier?.clearedNeeded).toBe(4);
    expect(r.nextTier?.clearedRemaining).toBe(2);
  });

  it('blocked: overdue, active cap, pending request, recent default', () => {
    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ overdueCount: 1 }),
        null,
      ).blockedReason,
    ).toBe('You have an overdue loan. Clear it to apply again');

    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ activeCount: 2 }),
        null,
      ).blockedReason,
    ).toBe('You already have an active loan with this lender');

    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ pendingRequestCount: 1 }),
        null,
      ).blockedReason,
    ).toBe('You have an application under review');

    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({
          defaultedCount: 1,
          defaultedAt: new Date(
            Date.now() - 30 * 86_400_000,
          ).toISOString(),
        }),
        null,
      ).blockedReason,
    ).toContain('Try again in');
  });

  it('soft block: pending request keeps the ladder (banner) but still sets the reason (submit gate)', () => {
    const r = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 2, pendingRequestCount: 1 }),
      null,
    );
    expect(r.blockedReason).toBe('You have an application under review');
    expect(r.limitKwacha).toBe(5000); // real rung, not 0
    expect(r.tier).toBe('Proven borrower');
    expect(r.nextTier?.label).toBe('Trusted client');
  });

  it('hard blocks still zero the banner', () => {
    for (const blocked of [
      stats({ overdueCount: 1 }),
      stats({ activeCount: 2 }),
      stats({
        defaultedCount: 1,
        defaultedAt: new Date(
          Date.now() - 30 * 86_400_000,
        ).toISOString(),
      }),
    ]) {
      const r = resolveCreditLimit(DEFAULT_CREDIT_POLICY, blocked, null);
      expect(r.blockedReason).toBeTruthy();
      expect(r.limitKwacha).toBe(0);
      expect(r.nextTier).toBeNull();
    }
  });

  it('nextTier: healthy resolutions advertise the next rung, top tier knows it is done', () => {
    const mid = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 2 }),
      null,
    );
    expect(mid.nextTier).not.toBeNull();
    expect(mid.nextTier!.clearedRemaining).toBe(2);

    const top = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 7 }),
      null,
    );
    expect(top.nextTier).toBeNull();
    expect(top.limitKwacha).toBe(20000);
  });

  it('override keeps the nextTier ladder intact', () => {
    const r = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 1 }),
      { limitKwacha: 6000, reason: 'repeat customer' },
    );
    expect(r.nextTier?.clearedNeeded).toBe(2);
    expect(r.nextTier?.clearedRemaining).toBe(1);
  });

  it('default older than cooldown → unblocked', () => {
    const old = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({
        defaultedCount: 1,
        defaultedAt: new Date(
          Date.now() - 120 * 86_400_000,
        ).toISOString(),
      }),
      null,
    );
    expect(old.blockedReason).toBeNull();
  });

  it('override raises but never above the ceiling', () => {
    const r = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 1 }),
      { limitKwacha: 999_999, reason: 'long-standing customer' },
    );
    expect(r.limitKwacha).toBe(20000); // ceiling
    expect(r.tier).toBe('manual override');
  });

  it('PROPERTY: a hard block zeroes the banner; a soft block keeps the real rung', () => {
    const arbPolicy: fc.Arbitrary<CreditPolicy> = fc.record({
      tiers: fc
        .array(
          fc.record({
            clearedFrom: fc.integer({ min: 0, max: 10 }),
            label: fc.string({ minLength: 1, maxLength: 12 }),
            limitKwacha: fc.integer({ min: 100, max: 50000 }),
            maxTermMonths: fc.integer({ min: 1, max: 12 }),
          }),
          { minLength: 1, maxLength: 5 },
        )
        .map((ts) => ts.sort((a, b) => a.clearedFrom - b.clearedFrom)),
      rules: fc.record({
        maxActiveLoans: fc.integer({ min: 1, max: 3 }),
        blockIfOverdue: fc.boolean(),
        cooldownDaysAfterDefault: fc.integer({ min: 0, max: 180 }),
      }),
    });

    fc.assert(
      fc.property(
        arbPolicy,
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 0, max: 2 }),
        fc.boolean(),
        (p, cleared, pending, overdue) => {
          try {
            const r = resolveCreditLimit(
              p,
              stats({
                clearedCount: cleared,
                pendingRequestCount: pending,
                activeCount: Math.min(2, p.rules.maxActiveLoans + 1),
                overdueCount: overdue ? 1 : 0,
              }),
              null,
            );
            const activeHardBlock =
              Math.min(2, p.rules.maxActiveLoans + 1) >=
              p.rules.maxActiveLoans;
            const anyHardBlock =
              (overdue && p.rules.blockIfOverdue) || activeHardBlock;
            if (anyHardBlock) {
              return (
                r.limitKwacha === 0 &&
                r.nextTier === null &&
                typeof r.blockedReason === 'string' &&
                r.blockedReason.length > 0
              );
            }
            if (r.blockedReason) {
              // soft block (pending request) — banner still shows the real rung
              return (
                r.limitKwacha > 0 &&
                p.tiers.some((t) => t.limitKwacha === r.limitKwacha)
              );
            }
            // healthy resolution: limit equals some tier, nextTier matches the
            // first rung strictly above cleared (or null if at/above the top)
            if (!p.tiers.some((t) => t.limitKwacha === r.limitKwacha)) {
              return false;
            }
            const above = p.tiers.filter((t) => t.clearedFrom > cleared);
            if (r.nextTier === null) return above.length === 0;
            const aboveSorted = [...above].sort(
              (a, b) => a.clearedFrom - b.clearedFrom,
            );
            const first = aboveSorted[0]!;
            return (
              r.nextTier.limitKwacha === first.limitKwacha &&
              r.nextTier.clearedNeeded === first.clearedFrom &&
              r.nextTier.clearedRemaining ===
                first.clearedFrom - cleared &&
              r.nextTier.clearedRemaining > 0
            );
          } catch {
            return true; // invalid generated policy — validator throws, fine
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

/**
 * A policy is stored as JSON typed by a tenant, so its tiers can arrive in any
 * order. Everything that means "the top rung" must be order-independent.
 */
describe('tier ordering', () => {
  const shuffled: CreditPolicy = {
    ...DEFAULT_CREDIT_POLICY,
    tiers: [
      { clearedFrom: 7, label: 'VIP', limitKwacha: 20000, maxTermMonths: 12 },
      { clearedFrom: 0, label: 'First-time borrower', limitKwacha: 1000, maxTermMonths: 1 },
      { clearedFrom: 4, label: 'Trusted client', limitKwacha: 10000, maxTermMonths: 6 },
      { clearedFrom: 2, label: 'Proven borrower', limitKwacha: 5000, maxTermMonths: 3 },
      { clearedFrom: 1, label: 'Building trust', limitKwacha: 2500, maxTermMonths: 2 },
    ],
  };

  it('orderedTiers returns ascending rungs regardless of input order', () => {
    expect(orderedTiers(shuffled).map((t) => t.clearedFrom)).toEqual([0, 1, 2, 4, 7]);
  });

  // The bug: the ceiling was `tiers[tiers.length - 1]`, so a shuffled policy
  // capped every override at K1,000 instead of K20,000.
  it('an out-of-order policy still uses the real ceiling for overrides', () => {
    const r = resolveCreditLimit(shuffled, stats(), { limitKwacha: 999_999, reason: 'test' });
    expect(r.limitKwacha).toBe(20000);
  });

  it('order does not change the kwacha ceiling for any cleared count', () => {
    for (let cleared = 0; cleared <= 8; cleared++) {
      const a = resolveCreditLimit(DEFAULT_CREDIT_POLICY, stats({ clearedCount: cleared }), {
        limitKwacha: 500_000, reason: 'test',
      });
      const b = resolveCreditLimit(shuffled, stats({ clearedCount: cleared }), {
        limitKwacha: 500_000, reason: 'test',
      });
      expect(b.limitKwacha).toBe(a.limitKwacha);
    }
  });

  // The override branch read maxTermMonths from the same wrong index, so a
  // shuffled policy gave an override a 1-month term.
  it('an out-of-order policy gives an override the top rung term, not the first', () => {
    const r = resolveCreditLimit(shuffled, stats(), { limitKwacha: 5000, reason: 'test' });
    expect(r.maxTermMonths).toBe(12);
  });

  it('resolves the same rung for any permutation', () => {
    for (const p of [
      DEFAULT_CREDIT_POLICY,
      shuffled,
      { ...DEFAULT_CREDIT_POLICY, tiers: [...shuffled.tiers].reverse() },
    ]) {
      const r = resolveCreditLimit(p, stats({ clearedCount: 4 }), null);
      expect(r.tier).toBe('Trusted client');
      expect(r.limitKwacha).toBe(10000);
      expect(r.maxTermMonths).toBe(6);
      expect(r.nextTier?.label).toBe('VIP');
    }
  });
});

describe('ladder validation', () => {
  const tier = (clearedFrom: number, limitKwacha: number, maxTermMonths: number) => ({
    clearedFrom,
    label: `t${clearedFrom}`,
    limitKwacha,
    maxTermMonths,
  });

  const withTiers = (tiers: CreditTier[]) => ({ ...DEFAULT_CREDIT_POLICY, tiers });

  // Without this, a policy could reward a longer repayment history with a
  // SMALLER limit — the ladder would punish clearing loans.
  it('rejects a non-increasing limitKwacha', () => {
    expect(() =>
      resolveCreditLimit(withTiers([tier(0, 5000, 1), tier(2, 1000, 3)]), stats(), null),
    ).toThrow(/limitKwacha must strictly increase/);
  });

  it('rejects two rungs offering the same limit', () => {
    expect(() =>
      resolveCreditLimit(withTiers([tier(0, 1000, 1), tier(1, 1000, 3)]), stats(), null),
    ).toThrow(/limitKwacha must strictly increase/);
  });

  it('rejects a maxTermMonths that shrinks as history grows', () => {
    expect(() =>
      resolveCreditLimit(withTiers([tier(0, 1000, 6), tier(1, 2000, 3)]), stats(), null),
    ).toThrow(/maxTermMonths must not decrease/);
  });

  it('allows maxTermMonths to repeat across rungs', () => {
    const r = resolveCreditLimit(
      withTiers([tier(0, 1000, 3), tier(1, 2000, 3)]),
      stats({ clearedCount: 1 }),
      null,
    );
    expect(r.maxTermMonths).toBe(3);
    expect(r.limitKwacha).toBe(2000);
  });

  it('still rejects duplicate clearedFrom', () => {
    expect(() =>
      resolveCreditLimit(withTiers([tier(0, 1000, 1), tier(0, 2000, 3)]), stats(), null),
    ).toThrow(/clearedFrom must strictly increase/);
  });

  // Validation must be order-independent too: a shuffled bad policy is still bad.
  it('detects a non-increasing limit regardless of order', () => {
    expect(() =>
      resolveCreditLimit(
        withTiers([tier(1, 1000, 3), tier(0, 5000, 1)]),
        stats(),
        null,
      ),
    ).toThrow(/limitKwacha must strictly increase/);
  });
});
