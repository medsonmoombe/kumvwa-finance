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
import { RecordRepaymentDto } from './dto/loans.dto';
import { LoansService } from './loans.service';

/** Lender portfolio view. Client-facing reads live in MyLoansController. */
@Roles('tenant_owner', 'tenant_staff')
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

  @Get(':id/repayments')
  repayments(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.loans.repaymentsForTenant(u.tenantId!, id);
  }

  /** `Idempotency-Key` makes a retried POST safe (no double-crediting). */
  @Post(':id/repayments')
  record(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: RecordRepaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.loans.recordRepayment(u.tenantId!, u.sub, id, dto, idempotencyKey);
  }
}
