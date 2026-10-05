import {
  DEFAULT_BILLING_PLAN,
  activeExtraSlots,
  capacityStatus,
  priceForSlots,
  resolveCapacity,
  slotExpiry,
  slotUnitPrice,
  validateBillingPlan,
  type BillingPlanShape,
  type SubscriptionShape,
} from './capacity';

const plan: BillingPlanShape = DEFAULT_BILLING_PLAN;

const sub = (over: Partial<SubscriptionShape> = {}): SubscriptionShape => ({
  status: 'active',
  includedClientsOverride: null,
  priceOverrideMinor: null,
  extraSlots: 0,
  slotsExpireAt: null,
  ...over,
});

const soon = new Date(Date.now() + 10 * 86_400_000); // 10 days out
const past = new Date(Date.now() - 10 * 86_400_000);

describe('client-slot capacity', () => {
  it('free floor: 3 clients, no slots', () => {
    expect(resolveCapacity(plan, sub())).toBe(3);
    const s = capacityStatus(plan, sub(), 2);
    expect(s.canAdd).toBe(true);
    expect(s.remaining).toBe(1);
    expect(s.unitPriceMinor).toBe('10000'); // K100
  });

  it('at the free floor: 3 used blocks a 4th', () => {
    const s = capacityStatus(plan, sub(), 3);
    expect(s.atLimit).toBe(true);
    expect(s.canAdd).toBe(false);
    expect(s.remaining).toBe(0);
  });

  it('paid slots raise capacity only while live', () => {
    expect(resolveCapacity(plan, sub({ extraSlots: 2, slotsExpireAt: soon }))).toBe(5);
    expect(resolveCapacity(plan, sub({ extraSlots: 2, slotsExpireAt: past }))).toBe(3);
    expect(activeExtraSlots(sub({ extraSlots: 2, slotsExpireAt: past }), new Date())).toBe(0);
  });

  it('platform-admin overrides win (promotions)', () => {
    const promo = sub({ includedClientsOverride: 10, priceOverrideMinor: 5000n });
    expect(resolveCapacity(plan, promo)).toBe(10);
    expect(slotUnitPrice(plan, promo)).toBe(5000n);
    expect(capacityStatus(plan, promo, 7).canAdd).toBe(true);
  });

  it('hard-blocked status zeroes capacity and forces the gate', () => {
    for (const status of ['suspended', 'cancelled']) {
      const s = capacityStatus(plan, sub({ status, extraSlots: 5, slotsExpireAt: soon }), 0);
      expect(s.blocked).toBe(true);
      expect(s.canAdd).toBe(false);
      expect(s.capacity).toBe(3); // floor only — paid slots do NOT count
    }
  });

  it('over-capacity tenants report remaining 0, never negative', () => {
    const s = capacityStatus(plan, sub(), 9);
    expect(s.remaining).toBe(0);
    expect(s.atLimit).toBe(true);
  });

  it('priceForSlots: K100 × n, override respected, bad input throws', () => {
    expect(priceForSlots(plan, sub(), 2)).toBe(20000n);
    expect(priceForSlots(plan, sub({ priceOverrideMinor: 2500n }), 3)).toBe(7500n);
    expect(() => priceForSlots(plan, sub(), 0)).toThrow();
    expect(() => priceForSlots(plan, sub(), 1.5)).toThrow();
  });

  it('slotExpiry is one calendar month, clamped', () => {
    const jan31 = new Date(Date.UTC(2026, 0, 31, 12, 0, 0));
    expect(slotExpiry(jan31).toISOString()).toBe(
      new Date(Date.UTC(2026, 1, 28, 12, 0, 0)).toISOString(),
    );
    const dec15 = new Date(Date.UTC(2026, 11, 15, 8, 30, 0));
    expect(slotExpiry(dec15).toISOString()).toBe(
      new Date(Date.UTC(2027, 0, 15, 8, 30, 0)).toISOString(),
    );
  });

  it('validateBillingPlan rejects bad shapes', () => {
    expect(() => validateBillingPlan(plan)).not.toThrow();
    expect(() => validateBillingPlan({ ...plan, includedClients: -1 })).toThrow();
    expect(() => validateBillingPlan({ ...plan, pricePerExtraClientMinor: -1n })).toThrow();
    expect(() => validateBillingPlan({ ...plan, interval: 'weekly' })).toThrow();
  });
});
