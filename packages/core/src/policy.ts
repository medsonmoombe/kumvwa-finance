/** Borrower facts the credit ladder resolves against. All counts are
 *  platform-wide except where noted; risk hygiene (overdue/default) is
 *  deliberately cross-lender. */
export interface BorrowerStats {
  /** Loans fully repaid (with the lender in question). */
  clearedCount: number;
  /** Applications in flight anywhere on the platform. */
  pendingRequestCount: number;
  /** Active loans with the lender in question. */
  activeCount: number;
  /** Overdue loans anywhere on the platform. */
  overdueCount: number;
  /** 1 when the borrower's most recent loan defaulted. */
  defaultedCount: number;
  /** ISO timestamp of that default, for the cooldown window. */
  defaultedAt: string | null;
}

export interface CreditPolicyRules {
  /** Concurrent active loans allowed with one lender. */
  maxActiveLoans: number;
  /** Any overdue loan anywhere blocks new borrowing. */
  blockIfOverdue: boolean;
  /** Days after a default before the borrower may apply again. */
  cooldownDaysAfterDefault: number;
}

/** One rung of the borrowing ladder. */
export interface CreditTier {
  /** Cleared loans needed to stand on this rung. */
  clearedFrom: number;
  label: string;
  limitKwacha: number;
  maxTermMonths: number;
}

export interface CreditPolicy {
  tiers: CreditTier[];
  rules: CreditPolicyRules;
}

/** Lender-granted manual limit (console drawer), capped by the ceiling. */
export interface LimitOverride {
  limitKwacha: number;
  reason: string;
}

export interface CreditResolution {
  limitKwacha: number;
  tier: string;
  maxTermMonths: number;
  blockedReason: string | null;
  /** The next rung of the ladder, for the "grow your limit" home hero.
   *  null when goalposts have been reached (top tier) or the client is
   *  hard-blocked. clearedRemaining is the DELTA from where the client stands. */
  nextTier: {
    label: string;
    limitKwacha: number;
    clearedNeeded: number;
    clearedRemaining: number;
  } | null;
}

/** Platform default until a tenant publishes their own ladder. */
export const DEFAULT_CREDIT_POLICY: CreditPolicy = {
  tiers: [
    { clearedFrom: 0, label: 'First-time borrower', limitKwacha: 1000, maxTermMonths: 1 },
    { clearedFrom: 1, label: 'Building trust', limitKwacha: 2500, maxTermMonths: 2 },
    { clearedFrom: 2, label: 'Proven borrower', limitKwacha: 5000, maxTermMonths: 3 },
    { clearedFrom: 4, label: 'Trusted client', limitKwacha: 10000, maxTermMonths: 6 },
    { clearedFrom: 7, label: 'VIP', limitKwacha: 20000, maxTermMonths: 12 },
  ],
  rules: { maxActiveLoans: 1, blockIfOverdue: true, cooldownDaysAfterDefault: 90 },
};

/**
 * Tiers in ascending rung order.
 *
 * Everything that depends on "the top rung" or "the entry rung" must use this,
 * never raw array order: a policy is stored as JSON by a tenant and its tiers
 * arrive in whatever order they were typed, so `tiers[tiers.length - 1]` is not
 * the top tier.
 */
export function orderedTiers(p: CreditPolicy): CreditTier[] {
  return [...p.tiers].sort((a, b) => a.clearedFrom - b.clearedFrom);
}

function validatePolicy(p: CreditPolicy): void {
  if (!Array.isArray(p.tiers) || p.tiers.length === 0) {
    throw new Error('Policy needs at least one tier');
  }
  for (const t of p.tiers) {
    if (!Number.isInteger(t.clearedFrom) || t.clearedFrom < 0) {
      throw new Error('bad clearedFrom');
    }
    if (!Number.isFinite(t.limitKwacha) || t.limitKwacha <= 0) {
      throw new Error('bad limitKwacha');
    }
    if (!Number.isInteger(t.maxTermMonths) || t.maxTermMonths < 1) {
      throw new Error('bad maxTermMonths');
    }
    if (typeof t.label !== 'string' || t.label.length === 0) {
      throw new Error('bad tier label');
    }
  }
  // Rungs must climb strictly — a duplicate clearedFrom makes "reached"
  // ambiguous and the banner's next-rung copy wrong.
  const sorted = orderedTiers(p);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.clearedFrom <= sorted[i - 1]!.clearedFrom) {
      throw new Error('clearedFrom must strictly increase');
    }
    // The whole promise of the ladder is that clearing loans raises your
    // limit. Without this a policy could reward a repayment history with a
    // smaller limit, and `ceiling` would be reached by the wrong rung.
    if (sorted[i]!.limitKwacha <= sorted[i - 1]!.limitKwacha) {
      throw new Error('limitKwacha must strictly increase');
    }
    // Term may legitimately repeat across rungs, but never shrink: a longer
    // history must never buy a shorter maximum term.
    if (sorted[i]!.maxTermMonths < sorted[i - 1]!.maxTermMonths) {
      throw new Error('maxTermMonths must not decrease');
    }
  }
  const r = p.rules;
  if (!r || !Number.isInteger(r.maxActiveLoans) || r.maxActiveLoans < 1) {
    throw new Error('bad maxActiveLoans');
  }
  if (typeof r.blockIfOverdue !== 'boolean') {
    throw new Error('bad blockIfOverdue');
  }
  if (!Number.isInteger(r.cooldownDaysAfterDefault) || r.cooldownDaysAfterDefault < 0) {
    throw new Error('bad cooldownDaysAfterDefault');
  }
}

export function resolveCreditLimit(
  policy: CreditPolicy,
  stats: BorrowerStats,
  override: LimitOverride | null,
  now: Date = new Date(),
): CreditResolution {
  validatePolicy(policy);
  const tiers = orderedTiers(policy);
  const top = tiers[tiers.length - 1]!;
  // validatePolicy guarantees limitKwacha increases, so the top rung is the
  // maximum — but take the max explicitly so this stays correct if the rule is
  // ever relaxed to allow flat rungs.
  const ceiling = Math.max(...tiers.map((t) => t.limitKwacha));

  if (stats.overdueCount > 0 && policy.rules.blockIfOverdue) {
    return {
      limitKwacha: 0,
      tier: 'blocked',
      maxTermMonths: 0,
      blockedReason: 'You have an overdue loan. Clear it to apply again',
      nextTier: null,
    };
  }

  if (stats.defaultedCount > 0 && stats.defaultedAt) {
    const since =
      (now.getTime() - new Date(stats.defaultedAt).getTime()) / 86_400_000;
    if (since < policy.rules.cooldownDaysAfterDefault) {
      const days = Math.ceil(policy.rules.cooldownDaysAfterDefault - since);
      return {
        limitKwacha: 0,
        tier: 'blocked',
        maxTermMonths: 0,
        blockedReason: `Account under review. Try again in ${days} days.`,
        nextTier: null,
      };
    }
  }

  if (stats.activeCount >= policy.rules.maxActiveLoans) {
    return {
      limitKwacha: 0,
      tier: 'blocked',
      maxTermMonths: 0,
      blockedReason: 'You already have an active loan with this lender',
      nextTier: null,
    };
  }

  // Rungs at or below the borrower's cleared count, highest first. clearedFrom
  // is validated non-negative, so this always matches at least the entry rung.
  const reached =
    [...tiers].reverse().find((t) => stats.clearedCount >= t.clearedFrom) ?? tiers[0]!;

  // The next rung strictly ABOVE the borrower's current cleared count — the
  // home "grow your limit" hero reads this straight off the resolution.
  const next = tiers.find((t) => t.clearedFrom > stats.clearedCount) ?? null;
  const nextTier = next
    ? {
        label: next.label,
        limitKwacha: next.limitKwacha,
        clearedNeeded: next.clearedFrom,
        clearedRemaining: next.clearedFrom - stats.clearedCount,
      }
    : null;

  const ladder = (
    tier: string,
    blockedReason: string | null,
  ): CreditResolution => ({
    limitKwacha: Math.min(reached.limitKwacha, ceiling),
    tier,
    maxTermMonths: reached.maxTermMonths,
    blockedReason,
    nextTier,
  });

  if (override) {
    // A manual override outranks the ladder's kwacha figure but never the
    // ceiling; a pending application still gates the SUBMIT below.
    const limit = Math.min(override.limitKwacha, ceiling);
    return {
      limitKwacha: limit,
      tier: 'manual override',
      maxTermMonths: top.maxTermMonths,
      blockedReason:
        stats.pendingRequestCount > 0
          ? 'You have an application under review'
          : null,
      nextTier,
    };
  }

  // One application at a time, platform-wide (M5+): a human reviews each
  // request, so a second request while one is in flight is refused outright.
  // The BANNER still shows the borrower's real rung — this is a soft block
  // (nothing is wrong with the borrower), unlike overdue/default which zero
  // the display. The submit-time refusal reads blockedReason, not the kwacha
  // figure, so capacity and refusal stay in sync.
  if (stats.pendingRequestCount > 0) {
    return ladder(reached.label, 'You have an application under review');
  }

  return ladder(reached.label, null);
}
