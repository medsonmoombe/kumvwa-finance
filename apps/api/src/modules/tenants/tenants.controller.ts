import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { SubmitVerificationDto, UpdateBrandingDto } from './dto/tenants.dto';
import { TenantsService } from './tenants.service';

@Roles('tenant_owner', 'tenant_staff')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('me')
  me(@CurrentUser() u: TokenClaims) {
    return this.tenants.me(u.tenantId!);
  }

  @Post('me/verification')
  submitVerification(
    @CurrentUser() u: TokenClaims,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.tenants.submitVerification(u.tenantId!, u.sub, dto);
  }

  /** Branding/business info read — reuses the public projection. */
  @Get('me/branding')
  branding(@CurrentUser() u: TokenClaims) {
    return this.tenants.publicInfo(u.tenantId!);
  }

  @Patch('me/branding')
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
