import { PrismaClient } from '@prisma/client';

import { logger } from '../logger';

const prisma = new PrismaClient();

/** Bound each tick so a backlog drains over several ticks, not one long one. */
const BATCH = 50;
/**
 * After this long in `processing` a payout is escalated for a human. Chosen well
 * beyond the provider's normal settlement window: escalating early would page
 * someone about a payout that was about to land.
 */
const STALL_MIN = 60 * 24;

/**
 * Watchdog for disbursements in flight.
 *
 * A `Payout` sitting in `processing` is money the lender believes left their
 * account but which may never have reached the borrower — the one failure mode
 * in this product that is invisible to the lender and unacceptable to the
 * borrower. This job makes sure such a row cannot be forgotten.
 *
 * It deliberately does NOT call the provider and does NOT settle anything. The
 * API's reconciler owns every provider call and every terminal transition,
 * because only it can run the ledger and loan-balance effects exactly once. A
 * second settler would double-post. This job only mirrors truth and escalates.
 */
export async function processPayoutQueue(): Promise<void> {
  const stallCutoff = new Date(Date.now() - STALL_MIN * 60_000);

  // 1. Mirror settled intents. The API sweep may have settled an intent whose
  //    payout row was written before the transition, leaving the two out of step.
  const settled = await prisma.payout.findMany({
    where: { status: 'processing', intent: { status: 'succeeded' } },
    select: { id: true },
    take: BATCH,
  });
  for (const p of settled) {
    await prisma.payout.updateMany({
      where: { id: p.id, status: 'processing' },
      data: { status: 'succeeded' },
    });
  }

  // 2. Mirror failed intents for the same reason, so a failed disbursement does
  //    not sit in the queue looking like money still in transit.
  const failed = await prisma.payout.findMany({
    where: { status: 'processing', intent: { status: { in: ['failed', 'cancelled', 'expired'] } } },
    select: { id: true, intentId: true },
    take: BATCH,
  });
  for (const p of failed) {
    if (!p.intentId) continue;
    const intent = await prisma.paymentIntent.findUnique({
      where: { id: p.intentId },
      select: { status: true },
    });
    if (!intent) continue;
    await prisma.payout.updateMany({
      where: { id: p.id, status: 'processing' },
      data: { status: intent.status },
    });
  }

  // 3. Escalate anything stalled past the hard deadline. Recorded as a note on
  //    the payout rather than a status change: no `PaymentStatus` means
  //    "unresolved", and inventing one would let it be mistaken for a settled
  //    or failed payment. A human resolves these from the Transactions tab.
  const stalled = await prisma.payout.findMany({
    where: {
      status: 'processing',
      createdAt: { lt: stallCutoff },
      intent: { status: { in: ['requires_action', 'processing'] } },
    },
    select: { id: true, tenantId: true, amountMinor: true, providerRef: true },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });
  for (const p of stalled) {
    await prisma.$transaction(async (tx) => {
      const res = await tx.payout.updateMany({
        where: { id: p.id, status: 'processing' },
        data: { failureReason: 'Unresolved past the settlement window — reconcile manually' },
      });
      if (res.count === 0) return;
      await tx.billingEvent.create({
        data: {
          tenantId: p.tenantId,
          type: 'payout_unresolved',
          fromValue: { payoutId: p.id, providerRef: p.providerRef },
          toValue: { action: 'manual_reconciliation_required' },
          note: 'Disbursement unresolved beyond the settlement window. No money was force-failed; confirm with the provider before re-sending.',
        },
      });
    });
  }

  if (settled.length > 0 || failed.length > 0 || stalled.length > 0) {
    logger.info(
      `payouts: ${settled.length} settled, ${failed.length} failed, ${stalled.length} escalated for reconciliation`,
    );
  }
}
