import { processEmailOutbox } from './consumers/email-outbox';
import { env } from './config';
import { logger } from './logger';

async function tick(): Promise<void> {
  // SMS/push consumers join this array as those milestones land (B5).
  await Promise.allSettled([processEmailOutbox()]);
}

async function main(): Promise<void> {
  logger.info(
    {
      smtp: env.SMTP_HOST ? `${env.SMTP_HOST}:${env.SMTP_PORT}` : 'dev-console',
      tickMs: env.WORKER_TICK_MS,
    },
    'worker started',
  );
  await tick();
  setInterval(() => void tick(), env.WORKER_TICK_MS);
}

void main();
