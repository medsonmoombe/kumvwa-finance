import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { PaymentProvider } from '@kumvwa/core';

import { ENV, type Env } from '../../../config/env';
import { AirtelMoneyProvider } from './airtel.provider';
import { CardPspProvider } from './card.provider';
import { MtnMomoProvider } from './mtn-momo.provider';
import type { PaymentProviderAdapter } from './provider.interface';
import { SandboxProvider } from './sandbox.provider';
import { ZamtelKwachaProvider } from './zamtel.provider';

/**
 * Resolves the driver for a rail.
 *
 * In `sandbox` mode (dev/CI) every rail routes to the deterministic sandbox, so
 * the whole flow is testable end to end with no live credentials.
 *
 * In `live` mode a rail is only offered if it actually has a credential — an
 * unconfigured rail fails with a 503 naming the variable to set, rather than
 * silently charging nothing or fabricating a success.
 */
@Injectable()
export class PaymentProviderRegistry {
  /** Built once at boot so a misconfigured rail is visible in the logs. */
  private readonly live: ReadonlyMap<PaymentProvider, PaymentProviderAdapter>;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly sandbox: SandboxProvider,
    mtn: MtnMomoProvider,
    airtel: AirtelMoneyProvider,
    zamtel: ZamtelKwachaProvider,
    card: CardPspProvider,
  ) {
    this.live = new Map(
      [mtn, airtel, zamtel, card]
        .filter((a) => a.isConfigured())
        .map((a) => [a.name, a] as const),
    );
  }

  /** Rails usable in this deployment, for diagnostics. */
  configuredProviders(): PaymentProvider[] {
    return this.env.PAYMENTS_DRIVER === 'sandbox'
      ? ['sandbox']
      : ([...this.live.keys()] as PaymentProvider[]);
  }

  get(provider: PaymentProvider): PaymentProviderAdapter {
    if (this.env.PAYMENTS_DRIVER === 'sandbox') return this.sandbox;
    const adapter = this.live.get(provider);
    if (!adapter) {
      throw new ServiceUnavailableException(
        `Payment provider '${provider}' is not available. Configured rails: ${
          this.configuredProviders().join(', ') || 'none'
        }. Set PAYMENTS_DRIVER=sandbox in dev, or add the ${provider} credentials.`,
      );
    }
    return adapter;
  }
}
