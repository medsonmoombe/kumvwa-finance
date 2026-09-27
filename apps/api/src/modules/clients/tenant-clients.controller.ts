import { Controller, Get, Param, Query } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { ClientsService, parseNrcSide } from './clients.service';

@Roles('tenant_owner', 'tenant_staff')
@Controller('clients')
export class TenantClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  @RequirePermissions('clients.read')
  list(@CurrentUser() u: TokenClaims, @Query('q') q?: string) {
    return this.clients.listForTenant(u.tenantId!, q);
  }

  @Get(':id')
  @RequirePermissions('clients.read')
  detail(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.clients.getForTenant(u.tenantId!, u.sub, id);
  }

  /** `?side=front|back` — each face is fetched (and audited) separately. */
  @Get(':id/nrc-photo')
  @RequirePermissions('clients.read')
  nrcPhoto(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Query('side') side?: string,
  ) {
    return this.clients.getNrcPhotoUrl(u.tenantId!, u.sub, id, parseNrcSide(side));
  }
}
