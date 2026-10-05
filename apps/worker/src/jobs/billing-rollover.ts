import { PrismaClient } from '@prisma/client';

import { logger } from '../logger';

const prisma = new PrismaClient();

/**
 * Client-slot billing runs on a one-month window. This sweep expires lapsed
 * slot purchases and returns the subscription to its free floor, so a lender
 * who stopped paying loses the PAID capacity exactly when the month ends.
 *
 * Existing clients are never removed — capacity only gates NEW additions.
 * Idempotent, so it is safe on every tick.
 */
export async function processBillingExpiry(): Promise<void> {
  const now = new Date();

  const expiredPurchases = await prisma.clientSlotPurchase.updateMany({
    where: { status: 'active', periodEnd: { lt: now } },
    data: { status: 'expired' },
  });

  const subs = await prisma.tenantSubscription.findMany({
    where: { extraSlots: { gt: 0 }, slotsExpireAt: { lt: now } },
    select: { id: true, tenantId: true, extraSlots: true, slotsExpireAt: true },
  });

  let reset = 0;
  for (const sub of subs) {
    await prisma.$transaction(async (tx) => {
      // Guarded on the current expiry so a concurrent top-up can't be erased.
      const res = await tx.tenantSubscription.updateMany({
        where: { id: sub.id, slotsExpireAt: sub.slotsExpireAt },
        data: { extraSlots: 0, slotsExpireAt: null },
      });
      if (res.count === 0) return;
      await tx.billingEvent.create({
        data: {
          tenantId: sub.tenantId,
          type: 'slots_expired',
          fromValue: { extraSlots: sub.extraSlots },
          toValue: { extraSlots: 0 },
          note: 'Monthly client slots lapsed',
        },
      });
      reset += 1;
    });
  }

  if (expiredPurchases.count > 0 || reset > 0) {
    logger.info(
      `billing: ${expiredPurchases.count} slot purchases expired, ` +
        `${reset} subscriptions returned to the free floor`,
    );
  }
}
