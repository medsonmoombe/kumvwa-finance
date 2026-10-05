import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { BillingService } from './billing.service';
import {
  CreatePlanDto,
  QuoteSlotsDto,
  SetSubscriptionDto,
  UpdatePlanDto,
} from './dto/billing.dto';

/**
 * Lender-facing billing: current plan, live client usage and slot purchases.
 * Buying slots runs through the payments engine (a `client_slots` intent), so
 * this controller only reads + quotes.
 */
@Roles('tenant_owner', 'tenant_staff')
@Controller('billing')
export class TenantBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('me')
  @RequirePermissions('billing.read')
  me(@CurrentUser() u: TokenClaims) {
    return this.billing.me(u.tenantId!);
  }

  /** Price preview for N extra client slots before starting a payment. */
  @Post('slots/quote')
  @RequirePermissions('billing.read')
  quote(@CurrentUser() u: TokenClaims, @Body() dto: QuoteSlotsDto) {
    return this.billing.quote(u.tenantId!, dto.count);
  }

  @Get('slots')
  @RequirePermissions('billing.read')
  purchases(@CurrentUser() u: TokenClaims) {
    return this.billing.purchasesFor(u.tenantId!);
  }
}

/**
 * Platform-admin control: manage plans/pricing, assign or customise a
 * lender's plan (promotions), suspend, and read the billing overview.
 */
@Roles('platform_admin')
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('overview')
  overview() {
    return this.billing.overview();
  }

  @Get('plans')
  listPlans() {
    return this.billing.listPlans();
  }

  @Post('plans')
  createPlan(@CurrentUser() u: TokenClaims, @Body() dto: CreatePlanDto) {
    return this.billing.createPlan(u.sub, dto);
  }

  @Patch('plans/:id')
  updatePlan(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.billing.updatePlan(u.sub, id, dto);
  }

  @Get('subscriptions')
  subscriptions(@Query('q') q?: string) {
    return this.billing.listSubscriptions(q);
  }

  @Patch('subscriptions/:tenantId')
  setSubscription(
    @CurrentUser() u: TokenClaims,
    @Param('tenantId') tenantId: string,
    @Body() dto: SetSubscriptionDto,
  ) {
    return this.billing.setSubscription(u.sub, tenantId, dto);
  }
}
