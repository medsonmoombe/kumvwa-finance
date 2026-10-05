import { HttpException, HttpStatus } from '@nestjs/common';

import { asAudit, asPrisma, auditMock } from '../../testing/mocks';
import { BillingService } from './billing.service';

const freePlan = {
  id: 'p1',
  key: 'free',
  name: 'Free',
  includedClients: 3,
  pricePerExtraClientMinor: 10_000n, // K100
  interval: 'monthly',
  active: true,
  isDefault: true,
};

function setup(
  overrides: {
    sub?: Record<string, unknown> | null;
    used?: number;
    plan?: typeof freePlan | null;
    planLookup?: typeof freePlan | null;
  } = {},
) {
  const prisma = {
    tenantSubscription: {
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.sub === undefined ? null : overrides.sub),
    },
    clientLenderLink: {
      count: jest.fn().mockResolvedValue(overrides.used ?? 0),
    },
    billingPlan: {
      // No subscription → the platform default plan.
      findFirst: jest
        .fn()
        .mockResolvedValue(
          overrides.plan === undefined ? freePlan : overrides.plan,
        ),
      // Has a subscription → its plan by id.
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.planLookup === undefined ? freePlan : overrides.planLookup,
        ),
    },
  };
  const svc = new BillingService(asPrisma(prisma), asAudit(auditMock()));
  return { svc, prisma };
}

const live = (extraSlots: number) => ({
  id: 'sub1',
  planId: 'p1',
  status: 'active',
  includedClientsOverride: null,
  priceOverrideMinor: null,
  extraSlots,
  slotsExpireAt: new Date(Date.now() + 10 * 86_400_000),
});

async function expectThrown(p: Promise<unknown>, status: number) {
  try {
    await p;
    throw new Error('expected a rejection');
  } catch (e) {
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getStatus()).toBe(status);
    return (e as HttpException).getResponse() as Record<string, unknown>;
  }
}

describe('BillingService.assertCanAddClient (the free-3 / K100 rule)', () => {
  it('allows a 4th client up to the free floor', async () => {
    const { svc } = setup({ used: 0 });
    await expect(svc.assertCanAddClient('t1')).resolves.toMatchObject({
      capacity: 3,
      used: 0,
      canAdd: true,
    });

    const { svc: full } = setup({ used: 2 });
    await expect(full.assertCanAddClient('t1')).resolves.toMatchObject({
      used: 2,
      remaining: 1,
      canAdd: true,
    });
  });

  it('blocks at 3 clients with 402 CLIENT_LIMIT (buy slots to continue)', async () => {
    const { svc } = setup({ used: 3 });
    const body = await expectThrown(svc.assertCanAddClient('t1'), HttpStatus.PAYMENT_REQUIRED);
    expect(body).toMatchObject({ code: 'CLIENT_LIMIT', capacity: 3, used: 3, remaining: 0 });
    // K100 per extra client, quoted back so the UI can upsell.
    expect(body['unitPriceMinor']).toBe('10000');
    expect(String(body['message'])).toContain('client limit');
  });

  it('lets paid slots lift the cap (3 free + 2 bought = 5)', async () => {
    const { svc } = setup({ sub: live(2), used: 3 });
    await expect(svc.assertCanAddClient('t1')).resolves.toMatchObject({
      capacity: 5,
      used: 3,
      remaining: 2,
      canAdd: true,
    });
  });

  it('drops back to the free floor once the month lapses', async () => {
    const expired = { ...live(2), slotsExpireAt: new Date(Date.now() - 1000) };
    const { svc } = setup({ sub: expired, used: 3 });
    const body = await expectThrown(svc.assertCanAddClient('t1'), HttpStatus.PAYMENT_REQUIRED);
    expect(body).toMatchObject({ code: 'CLIENT_LIMIT', capacity: 3, used: 3 });
  });

  it('respects a platform-admin override (promotion: 10 free)', async () => {
    const promo = { ...live(0), includedClientsOverride: 10 };
    const { svc } = setup({ sub: promo, used: 9 });
    await expect(svc.assertCanAddClient('t1')).resolves.toMatchObject({
      capacity: 10,
      remaining: 1,
      canAdd: true,
    });
  });

  it('hard-blocks a suspended lender with 403 BILLING_SUSPENDED', async () => {
    const suspended = { ...live(0), status: 'suspended' };
    const { svc } = setup({ sub: suspended, used: 1 });
    const body = await expectThrown(svc.assertCanAddClient('t1'), HttpStatus.FORBIDDEN);
    expect(body).toMatchObject({ code: 'BILLING_SUSPENDED' });
  });

  it('stopped counting paid slots as capacity when suspended', async () => {
    // A suspended lender owns live slots, but capacity must be 0, not 5.
    const suspended = { ...live(5), status: 'suspended' };
    const { svc } = setup({ sub: suspended, used: 0 });
    const body = await expectThrown(svc.assertCanAddClient('t1'), HttpStatus.FORBIDDEN);
    expect(body).toMatchObject({ code: 'BILLING_SUSPENDED' });
  });
});

describe('BillingService.quote', () => {
  it('prices N extra clients at K100 each', async () => {
    const { svc } = setup();
    await expect(svc.quote('t1', 2)).resolves.toMatchObject({
      count: 2,
      unitPriceMinor: '10000',
      totalMinor: '20000',
      total: '200.00',
      interval: 'monthly',
    });
  });

  it('uses the admin override price when one is set', async () => {
    const promo = { ...live(0), priceOverrideMinor: 5_000n };
    const { svc } = setup({ sub: promo });
    await expect(svc.quote('t1', 3)).resolves.toMatchObject({
      totalMinor: '15000',
      unitPriceMinor: '5000',
    });
  });

  it('rejects a non-positive slot count', async () => {
    const { svc } = setup();
    await expect(svc.quote('t1', 0)).rejects.toThrow(/positive integer/i);
  });
});
