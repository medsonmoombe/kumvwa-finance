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

  OTP_DEV_MODE: z.string().default('true').transform((v) => v === 'true'),
  OTP_DEV_CODE: z.string().regex(/^\d{6}$/).default('123456'),
  OTP_TTL_MIN: z.coerce.number().int().positive().default(10),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  SMS_PROVIDER: z.enum(['none', 'africastalking']).default('none'),
  SMS_SENDER_ID: z.string().default('KUMVWA'),
  AFRICASTALKING_API_KEY: z.string().default(''),
  AFRICASTALKING_USERNAME: z.string().default(''),

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
