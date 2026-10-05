import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import { ENV, type Env } from '../../../config/env';
import { HttpProviderAdapter } from './http-provider.base';

/**
 * Generic card PSP. Deliberately provider-neutral: card rails differ in SDK,
 * 3-D Secure hand-off and vaulting, so this adapter takes credentials for one
 * PSP rather than pretending to know which one Kumvwa will use. No card data
 * ever reaches Kumvwa's own servers — the API returns a client secret for the
 * PSP's own SDK to collect the PAN, and only the resulting token is stored.
 *
 * Still to fill in: the PSP's charge, vault and 3-D Secure hand-off.
 */
@Injectable()
export class CardPspProvider extends HttpProviderAdapter {
  readonly name: PaymentProvider = 'card_psp';

  constructor(@Inject(ENV) env: Env) {
    super({
      name: 'card_psp',
      baseUrl: env.CARD_PSP_BASE_URL,
      apiKeyHeader: 'Authorization',
      apiKey: env.CARD_PSP_API_KEY,
      webhookSecret: env.CARD_PSP_WEBHOOK_SECRET,
      displayName: 'card PSP',
    });
  }
}
