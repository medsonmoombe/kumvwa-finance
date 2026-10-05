import fc from 'fast-check';

import {
  DEFAULT_CREDIT_POLICY,
  resolveCreditLimit,
  type BorrowerStats,
  type CreditPolicy,
} from './policy';

const stats = (over: Partial<BorrowerStats> = {}): BorrowerStats => ({
  clearedCount: 0,
  pendingRequestCount: 0,
  activeCount: 0,
  overdueCount: 0,
  defaultedCount: 0,
  defaultedAt: null,
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
  });

  it('blocked: overdue, active cap, pending request, recent default', () => {
    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ overdueCount: 1 }),
        null,
      ).blockedReason,
    ).toContain('overdue');
    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ activeCount: 1 }),
        null,
      ).blockedReason,
    ).toContain('active loan');
    // One application in flight blocks a second SUBMIT (server-enforced
    // rule) — but it's a soft block: the banner keeps showing the borrower's
    // real rung with the reason attached.
    const pending = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ pendingRequestCount: 1 }),
      null,
    );
    expect(pending.blockedReason).toContain('application under review');
    expect(pending.limitKwacha).toBe(1000);
    expect(pending.tier).toBe('First-time borrower');
    // The pending block is the only thing standing in the borrower's way —
    // the moment the review resolves, the same stats resolve healthy.
    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ pendingRequestCount: 0 }),
        null,
      ).blockedReason,
    ).toBeNull();
    const recent = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({
        defaultedCount: 1,
        defaultedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
      }),
      null,
    );
    expect(recent.blockedReason).toContain('Try again');
  });

  it('soft block: pending request keeps the ladder (banner) but still sets the reason (submit gate)', () => {
    // A borrower mid-review still sees their rung on the home banner —
    // zeroing it collapsed the hero to a welcome card (the regression the
    // mockup fixes). Only HARD blocks (overdue/default/active cap) zero.
    const r = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 2, pendingRequestCount: 1 }),
      null,
    );
    expect(r.limitKwacha).toBe(5000);
    expect(r.tier).toBe('Proven borrower');
    expect(r.maxTermMonths).toBe(3);
    expect(r.blockedReason).toContain('application under review');
    expect(r.nextTier).toEqual({
      label: 'Trusted client',
      limitKwacha: 10000,
      clearedNeeded: 4,
      clearedRemaining: 2,
    });
  });

  it('hard blocks still zero the banner', () => {
    for (const s of [
      stats({ overdueCount: 1 }),
      stats({
        defaultedCount: 1,
        defaultedAt: new Date().toISOString(),
      }),
      stats({ activeCount: 1 }),
    ]) {
      const r = resolveCreditLimit(DEFAULT_CREDIT_POLICY, s, null);
      expect(r.limitKwacha).toBe(0);
      expect(r.tier).toBe('blocked');
    }
  });

  it('nextTier: healthy resolutions advertise the next rung, top tier knows it is done', () => {
    const r = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 1 }),
      null,
    );
    // at 1 cleared the next rung is 2 -> 'Proven borrower' / K5,000
    expect(r.nextTier).toEqual({
      label: 'Proven borrower',
      limitKwacha: 5000,
      clearedNeeded: 2,
      clearedRemaining: 1,
    });

    const top = resolveCreditLimit(
      DEFAULT_CREDIT_POLICY,
      stats({ clearedCount: 7 }),
      null,
    );
    expect(top.nextTier).toBeNull();
    expect(top.limitKwacha).toBe(20000);

    // Blocked resolutions carry no next tier — the ladder is not the story.
    expect(
      resolveCreditLimit(
        DEFAULT_CREDIT_POLICY,
        stats({ activeCount: 1 }),
        null,
      ).nextTier,
    ).toBeNull();
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
        defaultedAt: new Date(Date.now() - 120 * 86_400_000).toISOString(),
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

  it('PROPERTY: limit is always 0 (with reason) or a configured tier limit', () => {
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
                overdueCount: overdue ? 1 : 0,
              }),
              null,
            );
            // Blocked resolutions split two ways: HARD blocks (overdue,
            // default cooldown, active cap) zero everything; the SOFT block
            // (pending request) keeps the borrower's real rung + nextTier so
            // the banner can keep showing, with the reason gating the submit.
            if (r.blockedReason) {
              if (overdue) {
                return r.limitKwacha === 0 && r.nextTier === null;
              }
              // pending-only soft block: real tier, real kwacha
              return (
                r.limitKwacha > 0 &&
                p.tiers.some((t) => t.limitKwacha === r.limitKwacha)
              );
            }
            if (!p.tiers.some((t) => t.limitKwacha === r.limitKwacha)) {
              return false;
            }
            // healthy resolutions advertise either the strict next rung or none
            const above = p.tiers.filter((t) => t.clearedFrom > cleared);
            if (r.nextTier === null) return above.length === 0;
            const aboveSorted = [...above].sort(
              (a, b) => a.clearedFrom - b.clearedFrom,
            );
            const first = aboveSorted[0]!;
            return (
              r.nextTier.limitKwacha === first.limitKwacha &&
              r.nextTier.clearedNeeded === first.clearedFrom &&
              r.nextTier.clearedRemaining === first.clearedFrom - cleared &&
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
