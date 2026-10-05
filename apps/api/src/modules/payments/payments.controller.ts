import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { CreateIntentDto, DisburseDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

/**
 * Payment intents. Every route a CLIENT app calls lives in a controller whose
 * role list literally contains 'client' (routing convention, same as
 * LoanPaymentsController). Object-level scope is enforced in the service —
 * a mismatch 404s, never 403s, so ids can't be probed.
 */
@Roles('tenant_owner', 'tenant_staff', 'client')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  list(
    @CurrentUser() u: TokenClaims,
    @Query('purpose') purpose?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number.parseInt(limit, 10) : 50;
    return this.payments.list(u, {
      purpose: purpose?.trim() || undefined,
      status: status?.trim() || undefined,
      limit: Number.isFinite(take) ? take : 50,
    });
  }

  /** `Idempotency-Key` makes a retried POST safe (no double-charging). */
  @Post('intents')
  @RequirePermissions('payments.charge')
  create(
    @CurrentUser() u: TokenClaims,
    @Body() dto: CreateIntentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.createIntent(u, dto, idempotencyKey);
  }

  @Get('intents/:id')
  get(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.payments.getIntentFor(u, id);
  }

  @Post('intents/:id/cancel')
  @RequirePermissions('payments.charge')
  cancel(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.payments.cancel(u, id);
  }
}

/** Platform-admin oversight: the cross-tenant transaction ledger. */
@Roles('platform_admin')
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('transactions')
  list(
    @Query('purpose') purpose?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number.parseInt(limit, 10) : 100;
    return this.payments.listAll({
      purpose: purpose?.trim() || undefined,
      status: status?.trim() || undefined,
      tenantId: tenantId?.trim() || undefined,
      limit: Number.isFinite(take) ? take : 100,
    });
  }
}

/** Lender-initiated payout of an approved loan to the borrower. */
@Roles('tenant_owner', 'tenant_staff')
@Controller('payments')
export class DisbursementsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('disbursements')
  @RequirePermissions('payments.disburse')
  create(
    @CurrentUser() u: TokenClaims,
    @Body() dto: DisburseDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.payments.disburse(u, dto, idempotencyKey);
  }
}
