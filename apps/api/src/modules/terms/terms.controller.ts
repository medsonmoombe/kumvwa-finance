import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Request, Response } from 'express';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { textToPdf } from './pdf.util';
import { TermsService, type AcceptScope } from './terms.service';

class AcceptTermsDto {
  @IsIn(['platform_business', 'platform_client', 'tenant'])
  scope!: AcceptScope;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class PublishTermsDto {
  @IsString()
  @MinLength(50, { message: 'Terms must be at least 50 characters' })
  @MaxLength(20000)
  body!: string;
}

@Controller('terms')
export class TermsController {
  constructor(private readonly terms: TermsService) {}

  @Public()
  @Get('platform')
  async platform() {
    const p = await this.terms.platformLatest();
    if (!p) throw new NotFoundException('Platform terms not available');
    return { version: p.version, body: p.body, publishedAt: p.publishedAt };
  }

  /**
   * Downloadable terms — a contract the user cannot retain is legally weak
   * (enforceability + DPA right of access). Public so the app's terms gate
   * and any browser can fetch it; the filename is versioned, so old
   * downloads never change meaning under the user.
   */
  @Public()
  @Get('platform/pdf')
  async platformPdf(@Res() res: Response) {
    const p = await this.terms.platformLatest();
    if (!p) throw new NotFoundException('Platform terms not available');
    const pdf = await textToPdf(
      'Kumvwa Finance — Platform Terms of Service',
      `Version ${p.version} · Published ${p.publishedAt.toDateString()}`,
      p.body,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kumvwa-platform-terms-v${p.version}.pdf"`,
    );
    res.send(pdf);
  }

  /** Same as above, per-lender. Public — shown pre-acceptance in the app. */
  @Public()
  @Get('tenant/:tenantId/pdf')
  async tenantPdf(@Param('tenantId') tenantId: string, @Res() res: Response) {
    const t = await this.terms.tenantLatest(tenantId);
    if (!t) throw new NotFoundException('This business has not published terms');
    const pdf = await textToPdf(
      `${t.tenant.name} — Lending Terms`,
      `Version ${t.version} · Published ${t.publishedAt.toDateString()}`,
      t.body,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${t.tenant.name.replaceAll(/\W+/g, '-').toLowerCase()}-terms-v${t.version}.pdf"`,
    );
    res.send(pdf);
  }

  @Roles('client')
  @Get('status')
  status(@CurrentUser() u: TokenClaims) {
    return this.terms.clientStatus(u.clientId!, u.sub);
  }

  /** Any authenticated role — platform re-acceptance or client tenant-terms. */
  @Post('accept')
  accept(
    @CurrentUser() u: TokenClaims,
    @Body() dto: AcceptTermsDto,
    @Req() req: Request,
  ) {
    return this.terms.accept({
      actorId: u.sub,
      clientId: u.role === 'client' ? u.clientId! : null,
      scope: dto.scope,
      tenantId: dto.tenantId,
      ip: req.ip,
    });
  }
}

/**
 * Console-facing tenant terms editing. The settings UI lands in M3; the
 * endpoints are ready so publishing doesn't need another API change.
 */
@Controller('tenants')
export class TenantTermsController {
  constructor(private readonly terms: TermsService) {}

  @Roles('tenant_owner', 'tenant_staff')
  @Get(':tenantId/terms')
  async current(
    @CurrentUser() u: TokenClaims,
    @Param('tenantId') tenantId: string,
  ) {
    if (tenantId !== u.tenantId) throw new NotFoundException('Terms not found');
    const t = await this.terms.tenantLatest(tenantId);
    return { version: t?.version ?? null, body: t?.body ?? null };
  }

  @Roles('tenant_owner')
  @RequirePermissions('terms.manage')
  @Post(':tenantId/terms')
  async publish(
    @CurrentUser() u: TokenClaims,
    @Param('tenantId') tenantId: string,
    @Body() dto: PublishTermsDto,
  ) {
    if (tenantId !== u.tenantId) throw new NotFoundException('Tenant not found');
    return this.terms.publishTenant(tenantId, u.sub, dto.body);
  }
}
