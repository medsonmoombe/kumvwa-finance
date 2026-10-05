import { config } from 'dotenv';
import { join } from 'node:path';

// Dev runs share the API's .env (DATABASE_URL, EMAIL_*). A worker-local .env
// may add keys afterwards — dotenv never overwrites already-set values.
config({ path: join(__dirname, '../../api/.env') });
config();

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  // EMAIL_* is canonical; SMTP_* remains a compatibility fallback.
  EMAIL_HOST: process.env.EMAIL_HOST ?? process.env.SMTP_HOST ?? '',
  EMAIL_PORT: num(process.env.EMAIL_PORT ?? process.env.SMTP_PORT, 1025),
  EMAIL_USER: process.env.EMAIL_USER ?? process.env.SMTP_USER ?? '',
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ?? process.env.SMTP_PASS ?? '',
  EMAIL_FROM:
    process.env.EMAIL_FROM ??
    process.env.SMTP_FROM ??
    'Kumvwa Finance <no-reply@kumvwa.co.zm>',
  WORKER_BATCH: num(process.env.WORKER_BATCH, 20),
  WORKER_TICK_MS: num(process.env.WORKER_TICK_MS, 15_000),
  /**
   * Firebase Cloud Messaging — HTTP v1 service account (JSON, or a path to the
   * file). Blank leaves push logged to the console instead of sent, which is
   * the dev default; in-app notifications never depend on it.
   */
  FCM_SERVICE_ACCOUNT_JSON: process.env.FCM_SERVICE_ACCOUNT_JSON ?? '',
  FCM_PROJECT_ID: process.env.FCM_PROJECT_ID ?? '',
};
