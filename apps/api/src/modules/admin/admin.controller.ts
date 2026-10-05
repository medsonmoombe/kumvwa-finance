import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { ReportsService } from '../reports/reports.service';
import {
  isLegalDocumentKind,
  type LegalDocumentKind,
} from '../terms/legal-documents';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { parseNrcSide } from '../clients/clients.service';
import { AdminService } from './admin.service';
import {
  ReviewVerificationDto,
  SetFlagDto,
  SetSettingDto,
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

function adminParseKind(v: string): LegalDocumentKind {
  if (!isLegalDocumentKind(v)) {
    throw new BadRequestException(
      `Unknown document "${v}". Expected "terms" or "privacy".`,
    );
  }
  return v;
}

@Roles('platform_admin')
@Controller('admin/tenants')
export class AdminTenantsController {
  constructor(private readonly admin: AdminService, private readonly auth: AuthService) {}

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

  @Post(':id/mobile-access-code')
  mobileAccessCode(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.auth.createLenderMobileAccessCodeForTenant(u.sub, id);
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

  /** Interest generated platform-wide, and per lender (contracted vs collected). */
  @Get('reports/interest')
  platformInterest() {
    return this.reports.platformInterest();
  }

  @Get('terms/platform')
  async getPlatformTerms() {
    const t = await this.terms.platformLatest('terms');
    if (!t) throw new NotFoundException('Platform terms not available');
    return {
      kind: 'terms',
      title: this.terms.documentTitle('terms'),
      version: t.version,
      body: t.body,
      publishedAt: t.publishedAt,
    };
  }

  @Post('terms/platform')
  publishPlatformTerms(
    @CurrentUser() u: TokenClaims,
    @Body() dto: PublishPlatformTermsDto,
  ) {
    return this.terms.publishPlatformDocument(u.sub, 'terms', dto.body);
  }

  /**
   * Terms and the Privacy Policy are the same kind of object — published,
   * versioned platform documents — so they share these routes rather than
   * growing a parallel set per document.
   *
   * `/history` MUST stay declared before the bare `/terms/platform/:kind`,
   * otherwise the parameterised route captures the literal `history` segment.
   */
  @Get('terms/platform/:kind/history')
  async platformDocumentHistory(@Param('kind') kind: string) {
    return this.terms.platformHistory(adminParseKind(kind));
  }

  @Get('terms/platform/:kind')
  async getPlatformDocument(@Param('kind') kind: string) {
    const k = adminParseKind(kind);
    const t = await this.terms.platformLatest(k);
    if (!t) throw new NotFoundException('Document not available');
    return {
      kind: k,
      title: this.terms.documentTitle(k),
      version: t.version,
      body: t.body,
      publishedAt: t.publishedAt,
    };
  }

  @Post('terms/platform/:kind')
  publishPlatformDocument(
    @CurrentUser() u: TokenClaims,
    @Param('kind') kind: string,
    @Body() dto: PublishPlatformTermsDto,
  ) {
    return this.terms.publishPlatformDocument(
      u.sub,
      adminParseKind(kind),
      dto.body,
    );
  }
}

/**
 * Platform settings CRUD.
 *
 * The keys are a fixed catalogue (see SETTING_DEFS) — an operator can change
 * and reset anything in it, but cannot invent a setting that no code reads.
 * Literal `restore` is declared before `:key` so it is not captured as a key.
 */
@Roles('platform_admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  list() {
    return this.platform.list();
  }

  @Post('restore')
  restore(@CurrentUser() u: TokenClaims) {
    return this.platform.restoreDefaults(u.sub);
  }

  @Get(':key')
  getOne(@Param('key') key: string) {
    return this.platform.get(key);
  }

  /** Create-or-update: the first write for a key creates its override row. */
  @Post(':key')
  create(@CurrentUser() u: TokenClaims, @Param('key') key: string, @Body() dto: SetSettingDto) {
    if (dto.key !== key) {
      throw new BadRequestException('Body key must match the path key');
    }
    return this.platform.set(key, dto.value, u.sub);
  }

  @Put(':key')
  update(@CurrentUser() u: TokenClaims, @Param('key') key: string, @Body() dto: SetSettingDto) {
    if (dto.key !== key) {
      throw new BadRequestException('Body key must match the path key');
    }
    return this.platform.set(key, dto.value, u.sub);
  }

  /** Removes the override, so the catalogue default applies again. */
  @Delete(':key')
  remove(@CurrentUser() u: TokenClaims, @Param('key') key: string) {
    return this.platform.remove(key, u.sub);
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

  // Literal routes before parameterised /:id
  @Get('stats')
  stats() {
    return this.audit.stats();
  }

  @Get()
  list(
    @Query('severity') severity?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('tenantId') tenantId?: string,
    @Query('limit') limit?: string,
  ) {
    const take = limit ? Number.parseInt(limit, 10) : 100;
    return this.audit.listAdminConsole({
      severity: severity?.trim() || undefined,
      action: action?.trim() || undefined,
      entity: entity?.trim() || undefined,
      tenantId: tenantId?.trim() || undefined,
      take: Number.isFinite(take) ? take : 100,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.audit.getOne(id);
  }
}
