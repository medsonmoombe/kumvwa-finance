import {
  BadRequestException,
  Controller,
  HttpCode,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@kumvwa/core';

import { Public } from '../../common/guards/public.decorator';
import { PaymentsService } from './payments.service';

/**
 * Provider callbacks. These are PUBLIC (the caller is a telco/PSP, not a
 * user) and rely on an HMAC signature + per-event dedupe instead of auth.
 * The raw body is required for the signature check, which is why the app is
 * booted with `rawBody: true`.
 */
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post(':provider')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  handle(
    @Param('provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!(PAYMENT_PROVIDERS as readonly string[]).includes(provider)) {
      throw new BadRequestException(`Unknown payment provider: ${provider}`);
    }
    const raw =
      req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const headers = req.headers as Record<string, string | string[] | undefined>;
    return this.payments.handleWebhook(provider as PaymentProvider, raw, headers);
  }
}
