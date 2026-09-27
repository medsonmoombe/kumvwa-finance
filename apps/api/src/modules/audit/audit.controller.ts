import { Controller, Get, Query } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AuditService } from './audit.service';

@Roles('platform_admin', 'tenant_owner', 'tenant_staff')
@RequirePermissions('audit.view')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@CurrentUser() user: TokenClaims, @Query('take') take?: string) {
    const parsed = take ? Number.parseInt(take, 10) : 100;
    return this.audit.list(
      user.role === 'platform_admin' ? undefined : user.tenantId ?? undefined,
      Number.isFinite(parsed) ? parsed : 100,
    );
  }
}
