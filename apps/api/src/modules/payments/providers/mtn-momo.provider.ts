import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import { ENV, type Env } from '../../../config/env';
import { HttpProviderAdapter } from './http-provider.base';

/**
 * MTN MoMo collections. MTN carries the largest share of Zambian mobile money
 * and is the default rail for 096/056/076 prefixes. Their Collections API issues
 * a request-id, the payer approves with a PIN on their handset, and settlement
 * arrives later as a webhook.
 *
 * Still to fill in from MTN's docs: the request and response bodies. Everything
 * shared — credential resolution, `+260` normalisation, idempotency keys,
 * timeouts, signature verification — is implemented in the base class.
 */
@Injectable()
export class MtnMomoProvider extends HttpProviderAdapter {
  readonly name: PaymentProvider = 'mtn_momo';

  constructor(@Inject(ENV) env: Env) {
    super({
      name: 'mtn_momo',
      baseUrl: env.MTN_MOMO_BASE_URL,
      apiKeyHeader: 'Authorization',
      apiKey: env.MTN_MOMO_SUBSCRIPTION_KEY,
      webhookSecret: env.MTN_MOMO_WEBHOOK_SECRET,
      displayName: 'MTN MoMo',
    });
  }
}
