import { Controller, Get, Query } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { ClientsService } from './clients.service';

/**
 * Lender-facing client list. Distinct from `clients/me`, which serves the
 * client's own profile.
 */
@Roles('tenant_owner', 'tenant_staff')
@Controller('clients')
export class TenantClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@CurrentUser() u: TokenClaims, @Query('q') q?: string) {
    return this.clients.listForTenant(u.tenantId!, q);
  }
}
