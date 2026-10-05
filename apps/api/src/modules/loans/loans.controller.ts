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
import { Roles } from '../../common/guards/roles.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { RecordRepaymentDto, RolloverDto } from './dto/loans.dto';
import { LoansService } from './loans.service';

/** Lender portfolio view. Client-facing reads live in MyLoansController. */
@Roles('tenant_owner', 'tenant_staff')
@RequirePermissions('loans.read')
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  list(
    @CurrentUser() u: TokenClaims,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.loans.listForTenant(u.tenantId!, status, q);
  }

  @Get(':id')
  detail(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.loans.getForTenant(u.tenantId!, id);
  }
}

/**
 * Every payment route the CLIENT app calls: record, history, rollover.
 *
 * WHY THIS CONTROLLER EXISTS (convention, not taste): NestJS matches routes
 * across controllers sharing `@Controller('loans')` by registration order, and
 * @Roles here is read with `getAllAndOverride(handler, class)` — so a handler
 * that lives inside the lender-only LoansController is unreachable for
 * borrowers no matter what its own signature looks like. Pay Now used to 403
 * clients with 'Insufficient role' for exactly that reason: `POST
 * /loans/:id/repayments` sat in the class decorated only with
 * ('tenant_owner', 'tenant_staff'). Rule: any endpoint a client app calls
 * lives HERE, in a controller whose role list literally contains 'client'.
 *
 * Scope is enforced in the service (deny-list): a mismatch 404s, never 403s,
 * so loan ids can't be probed across tenants or clients.
 */
@Roles('tenant_owner', 'tenant_staff', 'client')
@Controller('loans')
export class LoanPaymentsController {
  constructor(private readonly loans: LoansService) {}

  @Get(':id/repayments')
  history(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.loans.repaymentsForTenant(scopeOf(u), id);
  }

  /** `Idempotency-Key` makes a retried POST safe (no double-crediting). */
  @Post(':id/repayments')
  @RequirePermissions('loans.repayment')
  record(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: RecordRepaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.loans.recordRepayment(
      scopeOf(u),
      u.sub,
      id,
      dto,
      idempotencyKey,
    );
  }

  /**
   * "Pay interest & extend": a client may carry over their OWN loan, and
   * lender staff may do it on a customer's behalf (same money path either way
   * — the repayment row is attributed to the caller).
   */
  @Post(':id/rollover')
  @RequirePermissions('loans.rollover')
  rollover(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: RolloverDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.loans.rollover(u.sub, id, scopeOf(u), dto, idempotencyKey);
  }
}

/** Object-level scope of the caller: borrowers own loans, lenders book them. */
function scopeOf(u: TokenClaims): { tenantId?: string; clientId?: string } {
  return u.role === 'client'
    ? { clientId: u.clientId ?? undefined }
    : { tenantId: u.tenantId ?? undefined };
}
