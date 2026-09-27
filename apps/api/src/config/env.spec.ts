import { loadEnv } from './env';

const base: Record<string, string> = {
  DATABASE_URL: 'postgresql://kumvwa:kumvwa_dev@localhost:5432/kumvwa',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  NRC_HMAC_KEY: 'c'.repeat(32),
  FIELD_ENCRYPTION_KEY: 'd'.repeat(32),
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
    });
    expect(env.STORAGE_DRIVER).toBe('s3');
    expect(env.API_PUBLIC_URL).toBe('https://api.kumvwa.co.zm/api/v1');
  });
});
