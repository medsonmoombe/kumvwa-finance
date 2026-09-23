import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AdminService } from './admin.service';
import { ReviewVerificationDto } from './dto/admin.dto';

@Roles('platform_admin')
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.admin.listTenants(status);
  }

  @Patch(':id/verification')
  review(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.admin.review(u.sub, id, dto);
  }

  @Get(':id/identity')
  identity(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.admin.ownerIdentity(u.sub, id);
  }
}
