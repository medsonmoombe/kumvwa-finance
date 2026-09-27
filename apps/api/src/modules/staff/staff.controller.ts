import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { CreateRoleDto, CreateStaffDto, UpdateRoleDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

@Roles('tenant_owner', 'tenant_staff')
@RequirePermissions('staff.manage')
@Controller()
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get('staff') listStaff(@CurrentUser() user: TokenClaims) { return this.staff.listStaff(user.tenantId!); }
  @Post('staff') createStaff(@CurrentUser() user: TokenClaims, @Body() dto: CreateStaffDto) { return this.staff.createStaff(user.tenantId!, user.sub, dto); }
  @Post('staff/:id/resend-access') resendAccess(@CurrentUser() user: TokenClaims, @Param('id') id: string) { return this.staff.resendStaffAccessEmail(user.tenantId!, user.sub, id); }
  @Patch('staff/:id') updateStaff(@CurrentUser() user: TokenClaims, @Param('id') id: string, @Body() dto: UpdateStaffDto) { return this.staff.updateStaff(user.tenantId!, user.sub, id, dto); }
  @Delete('staff/:id') removeStaff(@CurrentUser() user: TokenClaims, @Param('id') id: string) { return this.staff.removeStaff(user.tenantId!, user.sub, id); }

  @Get('roles') listRoles(@CurrentUser() user: TokenClaims) { return this.staff.listRoles(user.tenantId!); }
  @Post('roles') createRole(@CurrentUser() user: TokenClaims, @Body() dto: CreateRoleDto) { return this.staff.createRole(user.tenantId!, user.sub, dto); }
  @Patch('roles/:id') updateRole(@CurrentUser() user: TokenClaims, @Param('id') id: string, @Body() dto: UpdateRoleDto) { return this.staff.updateRole(user.tenantId!, user.sub, id, dto); }
  @Delete('roles/:id') removeRole(@CurrentUser() user: TokenClaims, @Param('id') id: string) { return this.staff.removeRole(user.tenantId!, user.sub, id); }
}
