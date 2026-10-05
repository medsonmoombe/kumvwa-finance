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
  /** Set to 'disabled' to bypass console 2FA entirely (e.g. when email delivery is broken). */
  CONSOLE_OTP_FLOW: z.enum(['enabled', 'disabled']).default('enabled'),

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
  /** Max "pay interest & extend" extensions per loan lifetime. Hard-capped at 1. */
  ROLLOVER_MAX: z.coerce.number().int().positive().default(1),

  /**
   * Storage driver: 'local' stores files in the project `docs` folder and
   * streams uploads/downloads directly via the API. 's3' uses MinIO/AWS/R2.
   * Switching between storage backends only requires changing this variable.
   */
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: z.string().default('docs'),
  API_PUBLIC_URL: z.string().default('http://localhost:8080/api/v1'),

  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  /**
   * SigV4 signs the region into every request, so it must name the bucket's
   * real region: Backblaze B2 rejects `us-east-1` for a `us-east-005` bucket.
   * Left empty it is read off a Backblaze endpoint (see `resolveS3Region`);
   * MinIO ignores the value entirely, so the fallback is never load-bearing.
   */
  S3_REGION: z.string().default(''),
  S3_ACCESS_KEY: z.string().default('kumvwa-dev'),
  S3_SECRET_KEY: z.string().default('kumvwa-dev-secret'),
  S3_BUCKET: z.string().default('kumvwa-documents'),

  /**
   * Payments driver. 'sandbox' routes every rail (MTN/Airtel/Zamtel/card) to
   * the deterministic sandbox — the only supported value until real
   * credentials are wired. Prod refuses to boot in sandbox.
   */
  PAYMENTS_DRIVER: z.enum(['sandbox', 'live']).default('sandbox'),
  /** HMAC secret used to verify inbound payment webhooks. */
  PAYMENTS_WEBHOOK_SECRET: z
    .string()
    .min(16)
    .default('dev-only-payments-webhook-secret'),
  /** Minutes a payment intent stays open before it can be swept to expired. */
  PAYMENTS_INTENT_TTL_MIN: z.coerce.number().int().positive().default(15),

  /**
   * Per-rail credentials. Blank means "this rail is not enabled" — the registry
   * then refuses it with a 503 naming the missing variable rather than guessing.
   * Only consulted when PAYMENTS_DRIVER=live.
   */
  MTN_MOMO_BASE_URL: z.string().default('https://sandbox.momodeveloper.mtn.com'),
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().default(''),
  MTN_MOMO_WEBHOOK_SECRET: z.string().default(''),

  AIRTEL_MONEY_BASE_URL: z.string().default('https://openapi.airtel.africa'),
  AIRTEL_MONEY_CLIENT_ID: z.string().default(''),
  AIRTEL_MONEY_CLIENT_SECRET: z.string().default(''),
  AIRTEL_MONEY_WEBHOOK_SECRET: z.string().default(''),

  ZAMTEL_KWACHA_BASE_URL: z.string().default('https://api.zamtel.co.zm'),
  ZAMTEL_KWACHA_API_KEY: z.string().default(''),
  ZAMTEL_KWACHA_WEBHOOK_SECRET: z.string().default(''),

  CARD_PSP_BASE_URL: z.string().default('https://api.payments.example.com'),
  CARD_PSP_API_KEY: z.string().default(''),
  CARD_PSP_WEBHOOK_SECRET: z.string().default(''),

  /**
   * Firebase Cloud Messaging — HTTP v1. The legacy `FCM_SERVER_KEY` send API
   * was retired by Google, so a service account is the only way to deliver:
   * paste the service-account JSON here, or point at the file. Blank = push is
   * logged to the worker console instead of sent (the dev default). In-app
   * notifications work either way.
   */
  FCM_SERVICE_ACCOUNT_JSON: z.string().default(''),
  FCM_PROJECT_ID: z.string().default(''),
  SENTRY_DSN: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export const ENV = Symbol('ENV');

/** Any host a browser or a phone cannot reach, however well-formed it looks. */
const LOOPBACK_URL = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])([:/]|$)/i;

/**
 * Reads the region out of a Backblaze B2 endpoint, which always carries it:
 * `https://s3.us-east-005.backblazeb2.com` → `us-east-005`. Accepts the
 * bucket-in-hostname form too, and returns '' for anything that isn't B2
 * (MinIO, AWS, R2) so the caller can fall back.
 */
export function regionFromS3Endpoint(endpoint: string): string {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint)
    ? endpoint
    : `https://${endpoint}`;
  try {
    const match = /(?:^|\.)s3\.([a-z0-9-]+)\.backblazeb2\.com$/i.exec(
      new URL(withScheme).host,
    );
    return match?.[1] ?? '';
  } catch {
    return '';
  }
}

/**
 * Region handed to the S3 client for signing. Explicit config wins, then the
 * bucket's own region off a B2 endpoint, then the harmless MinIO/AWS default.
 */
export function resolveS3Region(env: Env): string {
  return env.S3_REGION || regionFromS3Endpoint(env.S3_ENDPOINT) || 'us-east-1';
}

/**
 * Deploy guard for storage. Both values below are *signed into the URLs handed
 * to clients* — a loopback value parses fine, boots fine, and then fails every
 * upload and every document view in production while the logs look healthy.
 * So prod fails at boot instead. Dev keeps its defaults.
 */
export function assertDeployableStorage(env: Env): void {
  if (env.NODE_ENV !== 'prod') return;

  const problems: string[] = [];

  if (LOOPBACK_URL.test(env.API_PUBLIC_URL)) {
    problems.push(
      `API_PUBLIC_URL="${env.API_PUBLIC_URL}" is a loopback address, so uploads and downloads would be signed for the API's own machine — no browser or phone can reach that. Set the public origin, e.g. https://api.example.com/api/v1`,
    );
  }
  if (env.STORAGE_DRIVER === 's3' && LOOPBACK_URL.test(env.S3_ENDPOINT)) {
    problems.push(
      `S3_ENDPOINT="${env.S3_ENDPOINT}" is a loopback address while STORAGE_DRIVER=s3, so clients could not upload to or read from the bucket. Point it at your MinIO/S3/R2 endpoint.`,
    );
  }
  // A plain-http endpoint fails in the browser for a reason nothing server-side
  // can see: an https console refuses to PUT to an http URL (mixed content)
  // and reports it as an opaque network error, before CORS is even consulted.
  // The API's own self-test still passes, so the config looks healthy.
  if (env.STORAGE_DRIVER === 's3' && !/^https:\/\//i.test(env.S3_ENDPOINT)) {
    problems.push(
      `S3_ENDPOINT="${env.S3_ENDPOINT}" is not https, so browsers block every upload as mixed content before storage is contacted. Use https, e.g. https://s3.us-east-005.backblazeb2.com`,
    );
  }
  // Same shape of silent failure: B2 signs the region, so a region that
  // disagrees with the endpoint rejects every presigned PUT and GET while the
  // API's own logs stay quiet. Only checked when S3_REGION is set by hand —
  // an empty value means "read it off the endpoint", which cannot disagree.
  const endpointRegion = regionFromS3Endpoint(env.S3_ENDPOINT);
  if (
    env.STORAGE_DRIVER === 's3' &&
    env.S3_REGION &&
    endpointRegion &&
    env.S3_REGION !== endpointRegion
  ) {
    problems.push(
      `S3_REGION="${env.S3_REGION}" does not match S3_ENDPOINT's region "${endpointRegion}", and Backblaze B2 rejects requests signed for the wrong region. Set S3_REGION=${endpointRegion} or leave it empty to detect it automatically.`,
    );
  }
  // `STORAGE_DRIVER=local` in prod is NOT fatal — a host can mount a
  // persistent volume — so StorageService logs the hazard loudly instead.
  if (problems.length > 0) {
    throw new Error(
      `Storage is not deployable in prod:\n${problems
        .map((p) => `  - ${p}`)
        .join('\n')}`,
    );
  }
}

/**
 * Deploy guard for payments. The sandbox rail must never run in production —
 * it would report charges as succeeded without moving any money. And a live
 * deployment must not keep the shipped dev webhook secret, or anyone could
 * forge a "payment succeeded" callback.
 */
export function assertDeployablePayments(env: Env): void {
  if (env.NODE_ENV !== 'prod') return;
  const problems: string[] = [];
  if (env.PAYMENTS_DRIVER === 'sandbox') {
    problems.push(
      'PAYMENTS_DRIVER=sandbox in prod — the sandbox approves charges without moving money. Set PAYMENTS_DRIVER=live and wire the provider credentials.',
    );
  }
  if (env.PAYMENTS_WEBHOOK_SECRET === 'dev-only-payments-webhook-secret') {
    problems.push(
      'PAYMENTS_WEBHOOK_SECRET is the shipped dev value — anyone could forge a payment webhook. Set a real secret (openssl rand -base64 48).',
    );
  }
  // `live` with no rail credentials looks configured and fails every payment at
  // the first request, far from the boot that caused it. Every rail also needs
  // its own webhook secret, or its callbacks are unverifiable and silently dropped.
  if (env.PAYMENTS_DRIVER === 'live') {
    const rails: Array<[string, string]> = [
      ['MTN MoMo', env.MTN_MOMO_SUBSCRIPTION_KEY],
      ['Airtel Money', env.AIRTEL_MONEY_CLIENT_ID],
      ['Zamtel Kwacha', env.ZAMTEL_KWACHA_API_KEY],
      ['card PSP', env.CARD_PSP_API_KEY],
    ];
    for (const [name, key] of rails) {
      if (!key) continue;
      if (!/^https:\/\//i.test(railBaseUrl(env, name))) {
        problems.push(
          `${name} is enabled but its base URL is not https. Set the matching *_BASE_URL to the provider's https endpoint.`,
        );
      }
      if (!railWebhookSecret(env, name)) {
        problems.push(
          `${name} is enabled but no webhook secret is set, so its payment callbacks cannot be verified. Set the matching *_WEBHOOK_SECRET (openssl rand -base64 48).`,
        );
      }
    }
    if (rails.every(([, key]) => !key)) {
      problems.push(
        'PAYMENTS_DRIVER=live but no rail has credentials (MTN_MOMO_SUBSCRIPTION_KEY, AIRTEL_MONEY_CLIENT_ID, ZAMTEL_KWACHA_API_KEY, CARD_PSP_API_KEY are all blank) — every payment would fail. Set at least one, or use PAYMENTS_DRIVER=sandbox.',
      );
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `Payments is not deployable in prod:\n${problems
        .map((p) => `  - ${p}`)
        .join('\n')}`,
    );
  }
}

/** Base URL for a rail by display name — keeps the guard above table-driven. */
function railBaseUrl(env: Env, name: string): string {
  switch (name) {
    case 'MTN MoMo':
      return env.MTN_MOMO_BASE_URL;
    case 'Airtel Money':
      return env.AIRTEL_MONEY_BASE_URL;
    case 'Zamtel Kwacha':
      return env.ZAMTEL_KWACHA_BASE_URL;
    default:
      return env.CARD_PSP_BASE_URL;
  }
}

function railWebhookSecret(env: Env, name: string): string {
  switch (name) {
    case 'MTN MoMo':
      return env.MTN_MOMO_WEBHOOK_SECRET;
    case 'Airtel Money':
      return env.AIRTEL_MONEY_WEBHOOK_SECRET;
    case 'Zamtel Kwacha':
      return env.ZAMTEL_KWACHA_WEBHOOK_SECRET;
    default:
      return env.CARD_PSP_WEBHOOK_SECRET;
  }
}

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
  assertDeployableStorage(parsed.data);
  assertDeployablePayments(parsed.data);
  return parsed.data;
}
