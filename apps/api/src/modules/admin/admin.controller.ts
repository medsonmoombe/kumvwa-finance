import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ReportsService } from '../reports/reports.service';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { parseNrcSide } from '../clients/clients.service';
import { AdminService } from './admin.service';
import {
  ReviewVerificationDto,
  SetFlagDto,
  UpdateTenantStatusDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';
import { PlatformService } from './platform.service';
import { TermsService } from '../terms/terms.service';

class PublishPlatformTermsDto {
  @IsString()
  @MinLength(50, { message: 'Terms must be at least 50 characters' })
  @MaxLength(20000)
  body!: string;
}

@Roles('platform_admin')
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly admin: AdminService) {}

  // Literal before parameterised — `stats` must not be captured by `:id`.
  @Get('stats')
  stats() {
    return this.admin.tenantsWithStats();
  }

  @Get()
  list(@Query('status') status?: string) {
    return this.admin.listTenants(status);
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.admin.setStatus(u.sub, id, dto.status);
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

  @Get(':id')
  detail(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.admin.tenantDetail(id, u.sub);
  }
}

/** Platform stats + the feature-flag switches (C4). */
@Roles('platform_admin')
@Controller('admin')
export class AdminPlatformController {
  constructor(
    private readonly admin: AdminService,
    private readonly platform: PlatformService,
    private readonly terms: TermsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  @Get('flags')
  flags() {
    return this.platform.allFlags();
  }

  @Post('flags')
  setFlag(@CurrentUser() u: TokenClaims, @Body() dto: SetFlagDto) {
    return this.platform.setFlag(dto.key, dto.value, u.sub);
  }

  @Get('reports/monthly')
  platformMonthly() {
    return this.reports.platformMonthly();
  }

  @Get('reports/par')
  platformPar() {
    return this.reports.platformPar();
  }

  @Get('terms/platform')
  async getPlatformTerms() {
    const t = await this.terms.platformLatest();
    if (!t) throw new NotFoundException('Platform terms not available');
    return { version: t.version, body: t.body, publishedAt: t.publishedAt };
  }

  @Post('terms/platform')
  publishPlatformTerms(
    @CurrentUser() u: TokenClaims,
    @Body() dto: PublishPlatformTermsDto,
  ) {
    return this.terms.publishPlatformTerms(u.sub, dto.body);
  }
}

@Roles('platform_admin')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list() {
    return this.admin.listUsers();
  }

  @Patch(':id/status')
  setStatus(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.admin.setUserStatus(u.sub, id, dto.status);
  }
}

@Roles('platform_admin')
@Controller('admin/clients')
export class AdminClientsController {
  constructor(private readonly admin: AdminService) {}

  @Get()
  list(@Query('q') q?: string) {
    return this.admin.listClients(q);
  }

  /**
   * A borrower's NRC photo for oversight. `?side=front|back` — each face is
   * presigned, and audited, separately. Literal route before `:id`.
   */
  @Get(':id/nrc-photo')
  nrcPhoto(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Query('side') side?: string,
  ) {
    return this.admin.clientNrcPhotoUrl(id, u.sub, parseNrcSide(side));
  }

  // Literal route first: `:id` must not shadow the list above.
  @Get(':id')
  detail(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.admin.clientDetail(id, u.sub);
  }
}

/** The compliance read — platform-wide audit with filters (C4). */
@Roles('platform_admin')
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('tenantId') tenantId?: string,
    @Query('take') take?: string,
  ) {
    const parsed = take ? Number.parseInt(take, 10) : 100;
    return this.audit.listFiltered({
      action: action?.trim() || undefined,
      entity: entity?.trim() || undefined,
      tenantId: tenantId?.trim() || undefined,
      take: Number.isFinite(parsed) ? parsed : 100,
    });
  }
}
