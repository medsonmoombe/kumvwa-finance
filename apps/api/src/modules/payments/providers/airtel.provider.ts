import { Inject, Injectable } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import { ENV, type Env } from '../../../config/env';
import { HttpProviderAdapter } from './http-provider.base';

/**
 * Airtel Money collections. Airtel needs a token exchange before each API call
 * and identifies itself per-transaction, so `authHeader` in a real
 * implementation would carry a freshly minted bearer token rather than the
 * client id — the `initiateCharge` override is where that lands.
 *
 * Still to fill in from Airtel's docs: token exchange plus request/response
 * bodies. The shared plumbing is in the base class.
 */
@Injectable()
export class AirtelMoneyProvider extends HttpProviderAdapter {
  readonly name: PaymentProvider = 'airtel_money';

  constructor(@Inject(ENV) env: Env) {
    super({
      name: 'airtel_money',
      baseUrl: env.AIRTEL_MONEY_BASE_URL,
      apiKeyHeader: 'Authorization',
      // Airtel issues a short-lived bearer token from id+secret; the id is what
      // marks this rail as configured, and the token exchange is the first step
      // of the real `initiateCharge`.
      apiKey: env.AIRTEL_MONEY_CLIENT_ID,
      webhookSecret: env.AIRTEL_MONEY_WEBHOOK_SECRET,
      displayName: 'Airtel Money',
    });
  }
}
