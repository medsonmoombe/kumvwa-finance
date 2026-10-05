import { PrismaClient } from '@prisma/client';

import { logger } from '../logger';

const prisma = new PrismaClient();

/** Bound each tick. */
const BATCH = 100;
/** Re-check a stuck delivery no more often than this. */
const RETRY_BACKOFF_MIN = [1, 5, 15, 60, 240];
/** After this many failures the delivery is left for a human. */
const MAX_ATTEMPTS = RETRY_BACKOFF_MIN.length;

/**
 * Retry queue for provider webhook deliveries.
 *
 * Webhooks are the primary way a charge learns it succeeded, but they are
 * outside our control: the provider may deliver while the API is down, or the
 * request may fail after the provider has already moved the money. Anything
 * logged as `received` or `failed` — rather than `processed` or `ignored` — is
 * a delivery this platform has not yet acted on, and an unacted-on delivery
 * means a payment that may be recorded as unpaid when it is actually paid.
 *
 * This job surfaces them and records why, so the condition is visible rather
 * than silent. It cannot re-deliver: re-POSTing a provider's own callback
 * would mean impersonating the provider, which is exactly what the signature
 * check exists to prevent. Recovery is the API's own reconciler sweeping the
 * intent against the provider — the same path that already works when webhooks
 * never arrive at all.
 */
export async function processWebhookQueue(): Promise<void> {
  const pending = await prisma.paymentWebhookEvent.findMany({
    where: { status: { in: ['received', 'failed'] } },
    select: {
      id: true,
      provider: true,
      eventId: true,
      status: true,
      error: true,
      signatureOk: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
    take: BATCH,
  });

  let unverified = 0;
  let unprocessed = 0;
  let escalated = 0;

  for (const event of pending) {
    // A bad signature is not a delivery problem and retrying cannot fix it —
    // the provider simply is not the one that signed this body. Marking it
    // `ignored` stops it occupying the queue forever, and keeps the record for
    // audit.
    if (!event.signatureOk) {
      await prisma.paymentWebhookEvent.updateMany({
        where: { id: event.id, status: { in: ['received', 'failed'] } },
        data: {
          status: 'ignored',
          error: event.error ?? 'signature could not be verified',
          processedAt: new Date(),
        },
      });
      unverified += 1;
      continue;
    }

    const attempts = attemptsFor(event.createdAt);
    if (attempts >= MAX_ATTEMPTS) {
      escalated += 1;
      continue;
    }
    unprocessed += 1;
  }

  if (pending.length > 0) {
    logger.info(
      `webhooks: ${pending.length} pending — ${unverified} unverifiable (ignored), ` +
        `${unprocessed} awaiting provider reconciliation, ${escalated} escalated`,
    );
    if (escalated > 0) {
      logger.warn(
        `webhooks: ${escalated} delivery/deliveries still unprocessed after ` +
          `${MAX_ATTEMPTS} sweeps. Confirm these charges against the provider ` +
          'dashboard before writing them off as unpaid.',
      );
    }
  }
}

function attemptsFor(createdAt: Date): number {
  const ageMin = (Date.now() - createdAt.getTime()) / 60_000;
  let attempts = 0;
  let elapsed = 0;
  for (const backoff of RETRY_BACKOFF_MIN) {
    elapsed += backoff;
    if (ageMin >= elapsed) attempts += 1;
  }
  return attempts;
}
