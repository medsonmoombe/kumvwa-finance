import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import { ENV, type Env } from '../../../config/env';
import type {
  ChargeInput,
  PaymentProviderAdapter,
  PayoutInput,
  ProviderResult,
  WebhookVerdict,
} from './provider.interface';
import { computeSignature, headerValue, verifySignature } from './webhook.util';

type Sim = 'succeed' | 'fail' | 'pending';

function simOf(metadata?: Record<string, unknown>): Sim {
  const v = metadata?.['simulate'];
  return v === 'fail' || v === 'pending' ? v : 'succeed';
}

/**
 * Deterministic sandbox rail used in dev/CI and as the default driver. It
 * mimics the real flow: a charge starts `processing` and settles on
 * query/webhook — so the async path (poll + webhook) is exercised, not
 * bypassed. `metadata.simulate = 'fail' | 'pending'` steers outcomes.
 *
 * The simulated state is encoded in the providerRef (`sbx_<intentId>_<sim>`)
 * so `queryStatus` — which only receives the ref — can resolve it.
 */
@Injectable()
export class SandboxProvider implements PaymentProviderAdapter {
  readonly name: PaymentProvider = 'sandbox';

  constructor(@Inject(ENV) private readonly env: Env) {}

  initiateCharge(input: ChargeInput): Promise<ProviderResult> {
    const sim = simOf(input.metadata);
    return Promise.resolve({
      status: 'processing',
      providerRef: `sbx_${input.intentId}_${sim}`,
    });
  }

  queryStatus(providerRef: string): Promise<ProviderResult> {
    const parts = providerRef.split('_');
    const sim = parts[parts.length - 1] as Sim;
    if (sim === 'fail') {
      return Promise.resolve({
        status: 'failed',
        providerRef,
        failureReason: 'Sandbox: simulated decline',
      });
    }
    if (sim === 'pending') return Promise.resolve({ status: 'processing', providerRef });
    return Promise.resolve({ status: 'succeeded', providerRef });
  }

  initiatePayout(input: PayoutInput): Promise<ProviderResult> {
    // Payouts settle instantly in the sandbox.
    return Promise.resolve({ status: 'succeeded', providerRef: `sbxpo_${input.intentId}` });
  }

  refund(providerRef: string): Promise<ProviderResult> {
    return Promise.resolve({ status: 'succeeded', providerRef });
  }

  verifyWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookVerdict {
    const signature = headerValue(headers, 'x-payments-signature');
    const ok = verifySignature(this.env.PAYMENTS_WEBHOOK_SECRET, raw, signature);

    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      body = {};
    }

    const str = (v: unknown): string | undefined =>
      typeof v === 'string' && v.length > 0 ? v : undefined;

    const rawStatus = str(body['status']);
    const status: WebhookVerdict['status'] =
      rawStatus === 'failed' || rawStatus === 'refunded' ? rawStatus : 'succeeded';

    return {
      ok,
      eventId: str(body['eventId']) ?? computeSignature('evt', raw),
      reference: str(body['reference']),
      providerRef: str(body['providerRef']),
      status,
      raw: body,
    };
  }
}
