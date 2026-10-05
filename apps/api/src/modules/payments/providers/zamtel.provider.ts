import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import { ENV, type Env } from '../../../config/env';
import { HttpProviderAdapter } from './http-provider.base';

/**
 * Zamtel Kwacha. Zamtel authenticates with an api-key header rather than a
 * bearer token, and its merchant number is configured per account — both are
 * differences this `config` literal already carries, so a future implementation
 * doesn't have to re-discover them.
 *
 * Still to fill in from Zamtel's docs: the request and response bodies.
 */
@Injectable()
export class ZamtelKwachaProvider extends HttpProviderAdapter {
  readonly name: PaymentProvider = 'zamtel_kwacha';

  constructor(@Inject(ENV) env: Env) {
    super({
      name: 'zamtel_kwacha',
      baseUrl: env.ZAMTEL_KWACHA_BASE_URL,
      apiKeyHeader: 'X-API-Key',
      apiKey: env.ZAMTEL_KWACHA_API_KEY,
      webhookSecret: env.ZAMTEL_KWACHA_WEBHOOK_SECRET,
      displayName: 'Zamtel Kwacha',
    });
  }
}
