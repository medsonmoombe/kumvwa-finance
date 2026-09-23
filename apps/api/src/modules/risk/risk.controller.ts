import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { PrismaService } from '../../infra/prisma.module';
import { RiskService } from './risk.service';

/**
 * Lender-facing risk read for ONE client, used by the console review drawer.
 * The client must be linked to the caller's tenant — object-level isolation,
 * 404 (never 403) otherwise, so client ids can't be probed across tenants.
 */
@Roles('tenant_owner', 'tenant_staff')
@Controller('clients')
export class TenantRiskController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: RiskService,
  ) {}

  @Get(':id/risk')
  async forTenant(
    @CurrentUser() u: TokenClaims,
    @Param('id') clientId: string,
  ) {
    const link = await this.prisma.clientLenderLink.findUnique({
      where: {
        clientId_tenantId: { clientId, tenantId: u.tenantId! },
      },
    });
    if (!link) throw new NotFoundException('Client not found');

    return this.risk.computeProfile(clientId);
  }
}
