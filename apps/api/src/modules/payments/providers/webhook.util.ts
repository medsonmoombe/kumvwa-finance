import { createHmac, timingSafeEqual } from 'node:crypto';

/** Hex HMAC-SHA256 of the raw request body under the provider secret. */
export function computeSignature(secret: string, raw: Buffer): string {
  return createHmac('sha256', secret).update(raw).digest('hex');
}

/**
 * Constant-time signature check. Returns false for any missing/blank input so
 * a provider that forgot to sign can never be treated as verified.
 */
export function verifySignature(
  secret: string,
  raw: Buffer,
  provided: string | undefined,
): boolean {
  if (!secret || !provided) return false;
  const expected = Buffer.from(computeSignature(secret, raw), 'utf8');
  const actual = Buffer.from(provided.trim().toLowerCase(), 'utf8');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** First value of a header that may be a string or string[]. */
export function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const v = headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}
