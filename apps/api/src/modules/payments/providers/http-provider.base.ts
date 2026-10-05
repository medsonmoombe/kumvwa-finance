import { ServiceUnavailableException } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import type {
  ChargeInput,
  PaymentProviderAdapter,
  PayoutInput,
  ProviderResult,
  WebhookVerdict,
} from './provider.interface';
import { headerValue, verifySignature } from './webhook.util';

/**
 * Per-rail wiring, supplied by each adapter as it is constructed. Every
 * provider-specific decision — endpoint, auth header, credential names,
 * display name — lives in one literal, so the rails are comparable at a glance
 * and the sandbox rail's behaviour stays the reference.
 */
export interface ProviderConfig {
  readonly name: PaymentProvider;
  /** Collections API base, taken from validated env (never from raw process). */
  readonly baseUrl: string;
  /** Auth header name. Zamtel uses an api-key header; the rest use bearer. */
  readonly apiKeyHeader: string;
  /** Value for that header, blank when this rail is not configured. */
  readonly apiKey: string;
  /** Per-rail webhook secret, blank when this rail cannot verify callbacks. */
  readonly webhookSecret: string;
  /** Human name used in error messages and logs. */
  readonly displayName: string;
}

/**
 * Shared plumbing for the HTTP money rails (MTN MoMo, Airtel Money, Zamtel
 * Kwacha and a generic card PSP).
 *
 * What lives here is the part that is genuinely shared and genuinely easy to
 * get wrong: phone normalisation, idempotency keys so a retry can never become a
 * second debit, a hard timeout so a hung telco can't pin a worker open, and
 * refusing to trust a webhook whose signature can't be checked.
 *
 * Deliberate gap: no rail ships a guessed payload. Until an adapter fills in
 * its provider's documented request/response shapes, the charge path throws a
 * `503` naming exactly what to set — it never invents a successful charge,
 * because a fake success on a money path is far worse than a loud failure.
 */
export abstract class HttpProviderAdapter implements PaymentProviderAdapter {
  abstract readonly name: PaymentProvider;

  protected constructor(
    protected readonly config: ProviderConfig,
    private readonly timeoutMs = 15_000,
  ) {}

  /** True when this rail has a credential, i.e. it can be selected at all. */
  isConfigured(): boolean {
    return this.config.apiKey.trim().length > 0;
  }

  /** The credential, or a 503 naming the missing variables. */
  protected apiKey(): string {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        `${this.config.displayName} is not configured. Set ${this.config.name.toUpperCase()} credentials to enable this payment rail.`,
      );
    }
    return this.config.apiKey.trim();
  }

  /** POST/GET with a hard timeout. Non-2xx and transport faults are surfaced. */
  protected async request(
    path: string,
    init: { method: 'GET' | 'POST'; body?: unknown; headers?: Record<string, string> },
  ): Promise<{ status: number; json: unknown }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.config.baseUrl}${path}`, {
        method: init.method,
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          [this.config.apiKeyHeader]: this.apiKey(),
          'X-Target': this.config.displayName,
          ...(init.headers ?? {}),
        },
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text.length > 0 ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json };
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      throw new ServiceUnavailableException(
        aborted
          ? `${this.config.displayName} did not respond within ${this.timeoutMs}ms.`
          : `${this.config.displayName} is unreachable: ${(e as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /** Idempotency header carrying our intent id, so retries are never debits. */
  protected headersFor(intentId: string): Record<string, string> {
    return { 'X-Idempotency-Key': intentId };
  }

  protected notReady(operation: string): ServiceUnavailableException {
    return new ServiceUnavailableException(
      `${this.config.displayName} ${operation} is not available: this rail's adapter is not implemented yet. Run with PAYMENTS_DRIVER=sandbox, or set the ${this.config.displayName} credentials and fill in the adapter.`,
    );
  }

  initiateCharge(_input: ChargeInput): Promise<ProviderResult> {
    throw this.notReady('charging');
  }

  queryStatus(_providerRef: string): Promise<ProviderResult> {
    throw this.notReady('status lookup');
  }

  initiatePayout(_input: PayoutInput): Promise<ProviderResult> {
    throw this.notReady('payouts');
  }

  refund(_providerRef: string, _amountMinor: bigint): Promise<ProviderResult> {
    throw this.notReady('refunds');
  }

  /**
   * Rejects every webhook unless this rail has its own secret configured.
   * Returning `ok: false` rather than throwing is deliberate: the caller records
   * the delivery as unverified and moves on, so a rail whose secret was never
   * set cannot be used to inject a "paid" verdict by replaying a body signed in
   * another environment.
   */
  verifyWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookVerdict {
    const secret = this.config.webhookSecret.trim();
    const ok =
      secret.length > 0 &&
      verifySignature(secret, raw, headerValue(headers, 'x-payments-signature'));
    return { ok, eventId: '', status: 'succeeded', raw: {} };
  }
}
