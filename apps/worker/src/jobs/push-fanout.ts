import { PrismaClient } from '@prisma/client';

import { env } from '../config';
import { fcmSender } from '../fcm';
import { logger } from '../logger';

const prisma = new PrismaClient();

/**
 * How long a notification must exist before it is eligible for fan-out. The row
 * is written by the API, and the accompanying business write may still be
 * committing; pushing a beat later also batches a burst into one pass.
 */
const SETTLE_MS = 5_000;

/** FCM v1 requires flat string values in `data`. */
function pushData(data: unknown): Record<string, string> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).map(([k, v]) => [
      k,
      typeof v === 'string' ? v : JSON.stringify(v),
    ]),
  );
}

/**
 * Fans notifications out to push. This is the piece that was missing: device
 * tokens were collected and Notification rows were written, but nothing ever
 * sent them, so users only ever saw in-app rows.
 *
 * Delivery is at-most-once per notification: `pushedAt` is stamped after the
 * attempt, including when FCM rejects it. A push is time-sensitive and
 * low-stakes, and retrying it forever would let one dead recipient wedge the
 * queue behind them — the in-app row remains the durable record either way.
 */
export async function processPushOutbox(): Promise<void> {
  const rows = await prisma.notification.findMany({
    where: { pushedAt: null, createdAt: { lt: new Date(Date.now() - SETTLE_MS) } },
    orderBy: { createdAt: 'asc' },
    take: env.WORKER_BATCH,
    select: { id: true, userId: true, title: true, body: true, data: true },
  });
  if (rows.length === 0) return;

  const sender = fcmSender();
  let sent = 0;
  let delivered = 0;

  for (const row of rows) {
    if (sender) {
      const tokens = await prisma.devicePushToken.findMany({
        where: { userId: row.userId },
        select: { token: true },
      });

      for (const { token } of tokens) {
        try {
          const outcome = await sender.send(token, {
            title: row.title,
            body: row.body,
            data: pushData(row.data),
          });
          if (outcome === 'sent') {
            sent += 1;
            delivered += 1;
          } else if (outcome === 'unregistered') {
            // The app is gone from that device; stop paying for the round trip.
            await prisma.devicePushToken.deleteMany({ where: { token } });
          }
        } catch (e) {
          // Network-level failure for one device must not skip the others.
          logger.error({ err: e, notificationId: row.id }, 'push-fanout: send threw');
        }
      }
    } else {
      logger.info(
        { userId: row.userId, title: row.title },
        'PUSH(dev-console) — set FCM_SERVICE_ACCOUNT_JSON to deliver',
      );
    }

    await prisma.notification.updateMany({
      where: { id: row.id, pushedAt: null },
      data: { pushedAt: new Date() },
    });
  }

  logger.info(
    `push-fanout: ${rows.length} notification(s), ${sent} message(s) sent ` +
      `(${delivered} device(s) reached)`,
  );
}
