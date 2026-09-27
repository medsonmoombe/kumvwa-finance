import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import {
  OverrideDto,
  PolicyService,
  PublishPolicyDto,
} from './policy.service';

/**
 * Lending rules endpoints (M5).
 *
 * Route convention (same rule as LoanPaymentsController): every handler a
 * caller needs lives under a controller whose @Roles literally lists that
 * role — RolesGuard reads `getAllAndOverride(handler, class)`, so method-level
 * roles override class-level ones (publish is owner-only on PUT).
 */
@Roles('tenant_owner', 'tenant_staff')
@Controller('tenants/me')
export class TenantPolicyController {
  constructor(private readonly policy: PolicyService) {}

  /** The ladder currently in force (platform default until first publish). */
  @Get('credit-policy')
  @RequirePermissions('policy.manage')
  get(@CurrentUser() u: TokenClaims) {
    return this.policy.getWithVersion(u.tenantId!);
  }

  @Roles('tenant_owner') // staff may read the ladder; only owners publish it
  @RequirePermissions('policy.manage')
  @Put('credit-policy')
  publish(@CurrentUser() u: TokenClaims, @Body() dto: PublishPolicyDto) {
    return this.policy.publish(u.tenantId!, u.sub, dto);
  }
}

@Roles('tenant_owner', 'tenant_staff')
@Controller('clients')
export class ClientCreditController {
  constructor(private readonly policy: PolicyService) {}

  /** Console drawer: tier, limit, blocked reason + override history. */
  @Get(':id/credit')
  credit(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.policy.clientCredit(u.tenantId!, id);
  }

  @Post(':id/limit-override')
  @RequirePermissions('clients.override')
  grant(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: OverrideDto,
  ) {
    return this.policy.grantOverride(u.tenantId!, u.sub, id, dto);
  }

  @Delete(':id/limit-override/:overrideId')
  @RequirePermissions('clients.override')
  revoke(
    @CurrentUser() u: TokenClaims,
    @Param('overrideId') overrideId: string,
  ) {
    return this.policy.revokeOverride(u.tenantId!, u.sub, overrideId);
  }
}
