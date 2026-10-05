import {
  loadEnv,
  regionFromS3Endpoint,
  resolveS3Region,
} from './env';

const base: Record<string, string> = {
  DATABASE_URL: 'postgresql://kumvwa:kumvwa_dev@localhost:5432/kumvwa',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  NRC_HMAC_KEY: 'c'.repeat(32),
  FIELD_ENCRYPTION_KEY: 'd'.repeat(32),
};

/**
 * Prod fixtures need one live rail, credential plus callback secret, otherwise
 * the deployability guard rejects them before the storage assertions under test
 * ever run. The platform runs one rail at a time, so one rail is enough.
 */
const liveRail = {
  MTN_MOMO_SUBSCRIPTION_KEY: 'test-mtn-key-0123456789abcdef',
  MTN_MOMO_WEBHOOK_SECRET: 'test-mtn-webhook-secret-0123456789',
};

describe('loadEnv', () => {
  it('applies defaults for optional values', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(8080);
    expect(env.OTP_DEV_MODE).toBe(true);
    expect(env.OTP_DEV_CODE).toBe('123456');
    expect(env.SMS_PROVIDER).toBe('none');
    expect(env.APP_DOWNLOAD_URL).toBe('https://kumvwa.finance');
  });

  it('parses OTP_DEV_MODE=false', () => {
    const env = loadEnv({ ...base, OTP_DEV_MODE: 'false' });
    expect(env.OTP_DEV_MODE).toBe(false);
  });

  it('throws on a missing required secret', () => {
    const rest: Record<string, string> = { ...base };
    delete rest.JWT_ACCESS_SECRET;
    expect(() => loadEnv(rest)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws on a short secret (fail-fast on weak config)', () => {
    expect(() =>
      loadEnv({ ...base, JWT_ACCESS_SECRET: 'short' }),
    ).toThrow();
  });

  it('parses CORS_ORIGINS into an array', () => {
    const env = loadEnv({
      ...base,
      CORS_ORIGINS: 'https://a.com, https://b.com',
    });
    expect(env.CORS_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  // ── storage deploy guard ──
  // Presigned URLs are handed to browsers and phones, so a loopback value is
  // only ever discovered in production as "uploads don't work". Boot fails.

  it('refuses a loopback API_PUBLIC_URL in prod', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'prod',
        API_PUBLIC_URL: 'http://localhost:8080/api/v1',
      }),
    ).toThrow(/API_PUBLIC_URL/);
  });

  it('refuses a loopback S3 endpoint when the S3 driver is on in prod', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'prod',
        STORAGE_DRIVER: 's3',
        API_PUBLIC_URL: 'https://api.kumvwa.co.zm/api/v1',
        S3_ENDPOINT: 'http://localhost:9000',
      }),
    ).toThrow(/S3_ENDPOINT/);
  });

  it('keeps dev loopback defaults working', () => {
    const env = loadEnv(base);
    expect(env.API_PUBLIC_URL).toBe('http://localhost:8080/api/v1');
    expect(env.STORAGE_DRIVER).toBe('local');
  });

  it('accepts a fully public prod storage config', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'prod',
      STORAGE_DRIVER: 's3',
      API_PUBLIC_URL: 'https://api.kumvwa.co.zm/api/v1',
      S3_ENDPOINT: 'https://r2.cloudflarestorage.com',
      PAYMENTS_DRIVER: 'live',
      PAYMENTS_WEBHOOK_SECRET: 'test-payments-secret-0123456789abcdef',
      ...liveRail,
    });
    expect(env.STORAGE_DRIVER).toBe('s3');
    expect(env.API_PUBLIC_URL).toBe('https://api.kumvwa.co.zm/api/v1');
  });

  // ── S3 signing region ──
  // B2 signs the region, so signing with the wrong one rejects every
  // presigned PUT and GET without any API-side error to go on.

  it('reads the region off a Backblaze endpoint', () => {
    expect(
      regionFromS3Endpoint('https://s3.us-east-005.backblazeb2.com'),
    ).toBe('us-east-005');
    expect(regionFromS3Endpoint('s3.eu-central-003.backblazeb2.com')).toBe(
      'eu-central-003',
    );
    // Bucket-in-hostname form, which B2 also accepts.
    expect(
      regionFromS3Endpoint('https://kumvwa-documents.s3.us-west-004.backblazeb2.com'),
    ).toBe('us-west-004');
  });

  it('returns no region for non-Backblaze endpoints', () => {
    expect(regionFromS3Endpoint('http://localhost:9000')).toBe('');
    expect(regionFromS3Endpoint('https://r2.cloudflarestorage.com')).toBe('');
    expect(regionFromS3Endpoint('not a url')).toBe('');
  });

  it('resolves the signing region: explicit wins, then the endpoint, then the default', () => {
    const b2 = 'https://s3.us-east-005.backblazeb2.com';
    expect(resolveS3Region(loadEnv({ ...base, S3_ENDPOINT: b2 }))).toBe(
      'us-east-005',
    );
    expect(
      resolveS3Region(
        loadEnv({ ...base, S3_ENDPOINT: b2, S3_REGION: 'us-west-004' }),
      ),
    ).toBe('us-west-004');
    // MinIO ignores it, so the fallback just has to be well-formed.
    expect(resolveS3Region(loadEnv(base))).toBe('us-east-1');
  });

  it('refuses a plain-http S3 endpoint in prod (browser mixed-content block)', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'prod',
        STORAGE_DRIVER: 's3',
        API_PUBLIC_URL: 'https://api.kumvwa.co.zm/api/v1',
        S3_ENDPOINT: 'http://s3.us-east-005.backblazeb2.com',
      }),
    ).toThrow(/S3_ENDPOINT/);
  });

  it('keeps a plain-http endpoint working in dev', () => {
    const env = loadEnv({
      ...base,
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'http://localhost:9000',
    });
    expect(resolveS3Region(env)).toBe('us-east-1');
  });

  it('refuses an S3_REGION that contradicts a Backblaze endpoint in prod', () => {
    expect(() =>
      loadEnv({
        ...base,
        NODE_ENV: 'prod',
        STORAGE_DRIVER: 's3',
        API_PUBLIC_URL: 'https://api.kumvwa.co.zm/api/v1',
        S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
        S3_REGION: 'us-east-1',
      }),
    ).toThrow(/S3_REGION/);
  });

  it('allows the empty S3_REGION that an auto-detected bucket region needs', () => {
    const env = loadEnv({
      ...base,
      NODE_ENV: 'prod',
      STORAGE_DRIVER: 's3',
      API_PUBLIC_URL: 'https://api.kumvwa.co.zm/api/v1',
      S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
      PAYMENTS_DRIVER: 'live',
      PAYMENTS_WEBHOOK_SECRET: 'test-payments-secret-0123456789abcdef',
      ...liveRail,
    });
    expect(resolveS3Region(env)).toBe('us-east-005');
  });

  // ── payments deploy guard ──
  // The sandbox rail approves charges WITHOUT moving money, and the shipped
  // dev webhook secret would let anyone forge a "payment succeeded" callback.
  // Both are only fatal in prod, where they'd otherwise fail silently.

  const prodBase = {
    ...base,
    NODE_ENV: 'prod',
    API_PUBLIC_URL: 'https://api.kumvwa.co.zm/api/v1',
    PAYMENTS_DRIVER: 'live',
    PAYMENTS_WEBHOOK_SECRET: 'test-payments-secret-0123456789abcdef',
  };

  it('refuses the sandbox payments driver in prod', () => {
    expect(() =>
      loadEnv({ ...prodBase, PAYMENTS_DRIVER: 'sandbox' }),
    ).toThrow(/PAYMENTS_DRIVER/);
  });

  // The launch-phase escape hatch: sandbox in prod is allowed ONLY through the
  // explicit flag, so an accidental default can never boot a simulated rail.
  it('boots sandbox in prod only through the explicit opt-in flag', () => {
    const env = loadEnv({
      ...prodBase,
      PAYMENTS_DRIVER: 'sandbox',
      PAYMENTS_ALLOW_SANDBOX_IN_PROD: 'true',
    });
    expect(env.PAYMENTS_DRIVER).toBe('sandbox');
    expect(env.PAYMENTS_ALLOW_SANDBOX_IN_PROD).toBe(true);
  });

  it('treats any other opt-in value as unset', () => {
    expect(() =>
      loadEnv({
        ...prodBase,
        PAYMENTS_DRIVER: 'sandbox',
        PAYMENTS_ALLOW_SANDBOX_IN_PROD: 'yes',
      }),
    ).toThrow(/PAYMENTS_DRIVER/);
  });

  // A forgeable "payment succeeded" callback is a bug in every mode, so the
  // flag must not waive the webhook-secret rule along with the driver rule.
  it('does not waive the dev webhook secret when opted in', () => {
    expect(() =>
      loadEnv({
        ...prodBase,
        PAYMENTS_DRIVER: 'sandbox',
        PAYMENTS_ALLOW_SANDBOX_IN_PROD: 'true',
        PAYMENTS_WEBHOOK_SECRET: 'dev-only-payments-webhook-secret',
      }),
    ).toThrow(/PAYMENTS_WEBHOOK_SECRET/);
  });

  it('refuses the shipped dev webhook secret in prod', () => {
    expect(() =>
      loadEnv({
        ...prodBase,
        PAYMENTS_WEBHOOK_SECRET: 'dev-only-payments-webhook-secret',
      }),
    ).toThrow(/PAYMENTS_WEBHOOK_SECRET/);
  });

  it('keeps sandbox payments working in dev', () => {
    expect(loadEnv(base).PAYMENTS_DRIVER).toBe('sandbox');
    expect(loadEnv(base).PAYMENTS_ALLOW_SANDBOX_IN_PROD).toBe(false);
  });
});
