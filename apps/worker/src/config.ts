import { config } from 'dotenv';
import { join } from 'node:path';

// Dev runs share the API's .env (DATABASE_URL, SMTP_*). A worker-local .env
// may add keys afterwards — dotenv never overwrites already-set values.
config({ path: join(__dirname, '../../api/.env') });
config();

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  // Empty SMTP_HOST = log-only dev mode (mirrors the SMS provider strategy).
  SMTP_HOST: process.env.SMTP_HOST ?? '',
  SMTP_PORT: num(process.env.SMTP_PORT, 1025),
  SMTP_USER: process.env.SMTP_USER ?? '',
  SMTP_PASS: process.env.SMTP_PASS ?? '',
  SMTP_FROM: process.env.SMTP_FROM ?? 'Kumvwa Finance <no-reply@kumvwa.co.zm>',
  WORKER_BATCH: num(process.env.WORKER_BATCH, 20),
  WORKER_TICK_MS: num(process.env.WORKER_TICK_MS, 15_000),
};
