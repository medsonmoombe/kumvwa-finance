import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { AllowUnverifiedTenant } from '../../common/guards/unverified-tenant.decorator';
import {
  ResubmitVerificationDto,
  SubmitVerificationDto,
  UpdateApplicationDto,
  UpdateBrandingDto,
} from './dto/tenants.dto';
import { TenantsService } from './tenants.service';

@Roles('tenant_owner', 'tenant_staff')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  @AllowUnverifiedTenant()
  me(@CurrentUser() u: TokenClaims) {
    return this.tenants.me(u.tenantId!);
  }

  @Post('me/verification')
  @AllowUnverifiedTenant()
  submitVerification(
    @CurrentUser() u: TokenClaims,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.tenants.submitVerification(u.tenantId!, u.sub, dto);
  }

  @Post('me/resubmit')
  @AllowUnverifiedTenant()
  resubmit(
    @CurrentUser() u: TokenClaims,
    @Body() dto: ResubmitVerificationDto,
  ) {
    return this.tenants.resubmitVerification(u.tenantId!, u.sub, dto);
  }

  @Patch('me/application')
  @AllowUnverifiedTenant()
  updateApplication(
    @CurrentUser() u: TokenClaims,
    @Body() dto: UpdateApplicationDto,
  ) {
    return this.tenants.updateRejectedApplication(u.tenantId!, u.sub, dto);
  }

  /** Branding/business info read — reuses the public projection. */
  @Get('me/branding')
  branding(@CurrentUser() u: TokenClaims) {
    // Private view (business info included) — the public projection stays on
    // the unauthenticated TenantPublicController route.
    return this.tenants.privateBranding(u.tenantId!);
  }

  @Patch('me/branding')
  @RequirePermissions('branding.manage')
  updateBranding(
    @CurrentUser() u: TokenClaims,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.tenants.updateBranding(u.tenantId!, u.sub, dto);
  }
}

/**
 * Public tenant projection — no auth. Powers the pre-login invite screen and
 * the client's first-login branding (name, color, logo, published terms).
 */
@Public()
@Controller('tenants')
export class TenantPublicController {
  constructor(private readonly tenants: TenantsService) {}

  @Get(':id/public-info')
  publicInfo(@Param('id') id: string) {
    return this.tenants.publicInfo(id);
  }
}
