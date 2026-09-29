import { Controller, Get, Param, Query } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AuditService } from './audit.service';

@Roles('tenant_owner', 'tenant_staff')
@RequirePermissions('audit.view')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  // Literal routes before parameterised /:id
  @Get('stats')
  stats(@CurrentUser() user: TokenClaims) {
    return this.audit.stats(user.tenantId ?? undefined);
  }

  @Get()
  list(
    @CurrentUser() user: TokenClaims,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number.parseInt(limit, 10) : 100;
    return this.audit.listConsole(
      user.tenantId!,
      severity?.trim() || undefined,
      Number.isFinite(take) ? take : 100,
    );
  }

  @Get(':id')
  getOne(@CurrentUser() user: TokenClaims, @Param('id') id: string) {
    return this.audit.getOne(id, user.tenantId ?? undefined);
  }
}
