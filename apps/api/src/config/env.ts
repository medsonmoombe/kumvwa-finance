import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['dev', 'test', 'prod']).default('dev'),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  NRC_HMAC_KEY: z.string().min(32),
  FIELD_ENCRYPTION_KEY: z.string().min(32),

  /**
   * Dev only: newly registered tenants skip the BOZ verification gate and can
   * lend immediately. Never enable in prod — the gate is the compliance story.
   */
  DEV_AUTO_VERIFY_TENANTS: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  OTP_DEV_MODE: z.string().default('true').transform((v) => v === 'true'),
  OTP_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  OTP_TTL_MIN: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  CONSOLE_2FA_TTL_MIN: z.coerce.number().int().positive().default(5),
  TRUSTED_DEVICE_DAYS: z.coerce.number().int().positive().default(30),

  SMS_PROVIDER: z.enum(['none', 'africastalking']).default('none'),
  SMS_SENDER_ID: z.string().default('KUMVWA'),
  AFRICASTALKING_API_KEY: z.string().default(''),
  AFRICASTALKING_USERNAME: z.string().default(''),

  /**
   * Email (invites, notifications). Empty SMTP_HOST = log-only dev mode,
   * mirroring the SMS strategy. Point at localhost:1025 for MailHog.
   */
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('Kumvwa Finance <no-reply@kumvwa.co.zm>'),
  APP_BASE_URL: z.string().default('http://localhost:5173'),

  /**
   * Public download page for the borrower mobile app. Attached to every
   * invite so the share card can carry BOTH the download link and the
   * sign-up code (link = get the app, code = redeem in-app).
   */
  APP_DOWNLOAD_URL: z.string().url().default('https://kumvwa.finance'),

  REQUEST_MIN_KWACHA: z.coerce.number().positive().default(100),
  REQUEST_MAX_TERM: z.coerce.number().int().positive().default(12),
  CREDIT_LIMIT_NO_HISTORY_KWACHA: z.coerce.number().positive().default(1000),
  /** Max consecutive "pay interest & extend" rollovers per loan. */
  ROLLOVER_MAX: z.coerce.number().int().positive().default(2),
  FCM_SERVER_KEY: z.string().default(''),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_ACCESS_KEY: z.string().default('kumvwa-dev'),
  S3_SECRET_KEY: z.string().default('kumvwa-dev-secret'),
  S3_BUCKET: z.string().default('kumvwa-documents'),

  FCM_PROJECT_ID: z.string().default(''),
  SENTRY_DSN: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

/** Fails fast at boot on any missing/weak config. Pure → unit-testable. */
export function loadEnv(
  raw: Record<string, string | undefined> = process.env,
): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
