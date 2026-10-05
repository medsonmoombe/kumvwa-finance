import { processBillingExpiry } from './jobs/billing-rollover';
import { processPayoutQueue } from './jobs/disbursement-queue';
import { processPushOutbox } from './jobs/push-fanout';
import { processWebhookQueue } from './jobs/webhook-retrier';
import { processEmailOutbox } from './consumers/email-outbox';
import { processOverdue } from './jobs/overdue';
import { env } from './config';
import { logger } from './logger';

/**
 * One housekeeping pass. Each job is independent, so `allSettled` means a
 * broken email consumer cannot stop billing expiry or the payout watchdog from
 * running — the payment jobs are the ones that must not be starved.
 */
async function tick(): Promise<void> {
  await Promise.allSettled([
    processEmailOutbox(),
    processPushOutbox(),
    processOverdue(),
    processBillingExpiry(),
    // Watchdogs. In-flight charges are reconciled by the API's own sweep
    // (it holds the provider registry); these jobs make sure nothing in flight
    // is forgotten, and escalate anything unresolved for a human.
    processPayoutQueue(),
    processWebhookQueue(),
  ]);
}

async function main(): Promise<void> {
  logger.info(
    {
      email: env.EMAIL_HOST ? `${env.EMAIL_HOST}:${env.EMAIL_PORT}` : 'dev-console',
      push: env.FCM_SERVICE_ACCOUNT_JSON ? 'fcm' : 'dev-console',
      tickMs: env.WORKER_TICK_MS,
    },
    'worker started',
  );
  await tick();
  setInterval(() => void tick(), env.WORKER_TICK_MS);
}

void main();
