/**
 * Client-slot billing rules (platform-wide).
 *
 * Every lender gets the first N clients FREE (default 3). Each ADDITIONAL
 * client costs a monthly per-slot fee (default K100 = 10000 ngwee). A lender
 * buys as many slots as they want for the month; the slots last exactly one
 * month, then capacity falls back to the plan's included floor.
 *
 * Money rule (platform): all amounts are integer MINOR units (ngwee).
 * This file is pure — no DB, no clock — so API, console and tests agree.
 */

/** A pricing plan. `includedClients` is the free floor; the rest is per slot. */
export interface BillingPlanShape {
  key: string;
  name: string;
  /** Clients covered by the plan before extra slots are needed (>= 0). */
  includedClients: number;
  /** Monthly price of ONE extra client slot, in ngwee. */
  pricePerExtraClientMinor: bigint;
  /** Interval label — only 'monthly' is implemented today. */
  interval: string;
  active: boolean;
}

/** A lender's subscription state, as stored on the tenant. */
export interface SubscriptionShape {
  /** active | past_due | grace | suspended | cancelled */
  status: string;
  /** Platform-admin override of the free floor (promotions). */
  includedClientsOverride: number | null;
  /** Platform-admin override of the per-slot price (promotions). */
  priceOverrideMinor: bigint | null;
  /** Slots paid for in the CURRENT period. */
  extraSlots: number;
  /** When the paid slots lapse. null = no paid slots on record. */
  slotsExpireAt: Date | null;
}

/** A tenant with no subscription row yet behaves like the free plan. */
export const DEFAULT_BILLING_PLAN: BillingPlanShape = {
  key: 'free',
  name: 'Free',
  includedClients: 3,
  pricePerExtraClientMinor: 10_000n, // K100.00 / month per extra client
  interval: 'monthly',
  active: true,
};

/** Statuses that still grant lending + capacity. Others are hard-blocked. */
const CAPACITY_GRANTING_STATUSES = new Set(['active', 'past_due', 'grace']);

/**
 * Paid slots count only while the subscription grants capacity AND the
 * purchase has not lapsed. `slotsExpireAt === null` means "no paid slots".
 */
export function activeExtraSlots(sub: SubscriptionShape, now: Date): number {
  if (!CAPACITY_GRANTING_STATUSES.has(sub.status)) return 0;
  if (sub.extraSlots <= 0) return 0;
  if (sub.slotsExpireAt === null) return 0;
  return sub.slotsExpireAt.getTime() > now.getTime() ? sub.extraSlots : 0;
}

/**
 * Total clients the lender may hold: the free floor (plan or override) plus
 * any live paid slots. Never negative.
 */
export function resolveCapacity(
  plan: BillingPlanShape,
  sub: SubscriptionShape,
  now: Date = new Date(),
): number {
  const floor = Math.max(
    sub.includedClientsOverride ?? plan.includedClients,
    0,
  );
  return floor + activeExtraSlots(sub, now);
}

/** Effective monthly price of one extra slot (override wins over plan). */
export function slotUnitPrice(
  plan: BillingPlanShape,
  sub: SubscriptionShape,
): bigint {
  return sub.priceOverrideMinor ?? plan.pricePerExtraClientMinor;
}

export interface CapacityStatus {
  /** Total clients allowed right now. */
  capacity: number;
  /** Clients the lender currently holds. */
  used: number;
  /** Free headroom (0 when full or over). */
  remaining: number;
  /** True when `used < capacity`. */
  canAdd: boolean;
  /** Monthly price of one extra slot, in ngwee. */
  unitPriceMinor: string;
  /** True when the lender is at or over capacity. */
  atLimit: boolean;
  /** True when the subscription is hard-blocked (suspended/cancelled). */
  blocked: boolean;
}

/**
 * The one function the API guard, the console usage bar and the mobile gate
 * all read. Pure so every layer renders the same numbers.
 */
export function capacityStatus(
  plan: BillingPlanShape,
  sub: SubscriptionShape,
  used: number,
  now: Date = new Date(),
): CapacityStatus {
  const blocked = !CAPACITY_GRANTING_STATUSES.has(sub.status);
  const capacity = resolveCapacity(plan, sub, now);
  const safeUsed = Math.max(used, 0);
  return {
    capacity,
    used: safeUsed,
    remaining: Math.max(capacity - safeUsed, 0),
    canAdd: !blocked && safeUsed < capacity,
    unitPriceMinor: slotUnitPrice(plan, sub).toString(),
    atLimit: safeUsed >= capacity,
    blocked,
  };
}

/** Price for buying `count` extra slots for the period. Throws on bad input. */
export function priceForSlots(
  plan: BillingPlanShape,
  sub: SubscriptionShape,
  count: number,
): bigint {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be a positive integer');
  }
  return slotUnitPrice(plan, sub) * BigInt(count);
}

/** Validates a plan before it can be published. Throws with a reason. */
export function validateBillingPlan(plan: BillingPlanShape): void {
  if (!plan.key || typeof plan.key !== 'string') {
    throw new Error('Plan key is required');
  }
  if (!plan.name || typeof plan.name !== 'string') {
    throw new Error('Plan name is required');
  }
  if (!Number.isInteger(plan.includedClients) || plan.includedClients < 0) {
    throw new Error('includedClients must be a non-negative integer');
  }
  if (plan.pricePerExtraClientMinor < 0n) {
    throw new Error('pricePerExtraClientMinor must not be negative');
  }
  if (plan.interval !== 'monthly') {
    throw new Error('Only the monthly interval is supported');
  }
}

/**
 * When a slot purchase made at `start` lapses. One calendar month, clamped to
 * the last day of the target month (31 Jan + 1mo → 28/29 Feb), matching
 * `addMonthsUtc` in @kumvwa/core/loans.
 */
export function slotExpiry(start: Date, months = 1): Date {
  const targetMonth = start.getUTCMonth() + months;
  const year = start.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      year,
      month,
      day,
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ),
  );
}
