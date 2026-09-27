import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';

/**
 * DRAFT v1 — replace with the legally reviewed text from the boss/lawyer.
 * Because acceptances record a version, swapping this for real copy later is
 * simply publishing v2; nothing here is binding until then.
 */
const PLATFORM_TERMS_V1 = `KUMVWA FINANCE — PLATFORM TERMS OF SERVICE (v1 · DRAFT)

1. WHAT KUMVWA IS
Kumvwa Finance is a software platform providing loan management tools to
verified lending businesses ("Lenders"). Kumvwa is NOT a lender and does not
provide credit.

2. LENDING DECISIONS ARE YOURS
Each Lender is solely responsible for assessing borrowers, setting loan terms,
approving or declining loans, and collecting repayments. Kumvwa does not assess
credit risk on any borrower's behalf, and any risk indicator shown in the
platform is informational only.

3. NO LIABILITY FOR LENDING OUTCOMES
To the maximum extent permitted by law, Kumvwa is not liable for any loss
arising from lending decisions, borrower default, repayment behaviour, or the
use of information provided through the platform.

4. LENDER ELIGIBILITY
Lender accounts are available only to businesses holding a valid Bank of Zambia
registration, which must be maintained in good standing. Kumvwa may suspend
accounts whose registration lapses.

5. DATA AND PRIVACY
Personal data is processed per the Privacy Policy and the Zambia Data
Protection Act, 2021. Lenders are independently responsible for their lawful
basis for processing borrower data they enter into the platform.

[FULL TEXT PENDING LEGAL REVIEW — v1 placeholder]`;

export type AcceptScope = 'platform_business' | 'platform_client' | 'tenant';

/** Kumvwa's default brand blue until a lender customises their own. */
export const DEFAULT_PRIMARY_COLOR = '#1A4FBF';

@Injectable()
export class TermsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly audit: AuditService,
  ) {}

  /** Idempotent bootstrap — v1 template exists before any registration. */
  async onModuleInit(): Promise<void> {
    const existing = await this.prisma.platformTerms.findUnique({
      where: { version: 1 },
    });
    if (!existing) {
      await this.prisma.platformTerms.create({
        data: { version: 1, body: PLATFORM_TERMS_V1 },
      });
    }
  }

  platformLatest() {
    return this.prisma.platformTerms.findFirst({
      orderBy: { version: 'desc' },
    });
  }

  tenantLatest(tenantId: string) {
    return this.prisma.tenantTerms.findFirst({
      where: { tenantId },
      orderBy: { version: 'desc' },
      // The PDF endpoint titles the document with the business name.
      include: { tenant: { select: { name: true } } },
    });
  }

  /** Platform admins publish a new platform terms version. */
  async publishPlatformTerms(actorId: string, body: string) {
    const latest = await this.platformLatest();
    const created = await this.prisma.platformTerms.create({
      data: { version: (latest?.version ?? 0) + 1, body: body.trim() },
    });
    await this.audit.record({
      actorId,
      action: 'terms.publish_platform',
      entity: 'PlatformTerms',
      entityId: created.id,
      diff: { version: created.version },
    });
    return { version: created.version };
  }

  /** Publishes a NEW version (never edits history — acceptances reference versions). */
  async publishTenant(tenantId: string, actorId: string, body: string) {
    const latest = await this.tenantLatest(tenantId);
    const created = await this.prisma.tenantTerms.create({
      data: { tenantId, version: (latest?.version ?? 0) + 1, body: body.trim() },
    });
    await this.audit.record({
      actorId,
      action: 'terms.publish',
      entity: 'TenantTerms',
      entityId: created.id,
      tenantId,
      diff: { version: created.version },
    });
    return { version: created.version };
  }

  async accept(params: {
    actorId: string;
    clientId: string | null;
    scope: AcceptScope;
    tenantId?: string;
    ip?: string;
  }) {
    if (params.scope === 'tenant') {
      if (!params.tenantId) {
        throw new BadRequestException('tenantId is required for tenant terms');
      }
      const t = await this.tenantLatest(params.tenantId);
      if (!t) {
        throw new NotFoundException('This business has not published terms yet');
      }
      await this.prisma.termsAcceptance.create({
        data: {
          actorId: params.actorId,
          clientId: params.clientId,
          scope: 'tenant',
          tenantId: params.tenantId,
          tenantVersion: t.version,
          ip: params.ip,
        },
      });
      return { scope: 'tenant' as const, version: t.version };
    }

    const platform = await this.platformLatest();
    if (!platform) throw new NotFoundException('Platform terms not available');
    await this.prisma.termsAcceptance.create({
      data: {
        actorId: params.actorId,
        clientId: params.clientId,
        scope: params.scope,
        platformVersion: platform.version,
        ip: params.ip,
      },
    });
    return { scope: params.scope, version: platform.version };
  }

  /**
   * One call the client app makes after login to decide which screens to show:
   * platform acceptance, per-lender terms + branding (contextual white-label).
   */
  async clientStatus(clientId: string, userId: string) {
    const platform = await this.platformLatest();
    if (!platform) throw new NotFoundException('Platform terms not available');

    const [platformAccepted, links] = await Promise.all([
      this.prisma.termsAcceptance.findFirst({
        where: {
          actorId: userId,
          scope: 'platform_client',
          platformVersion: platform.version,
        },
      }),
      this.prisma.clientLenderLink.findMany({
        where: { clientId },
        include: {
          tenant: {
            include: {
              logoFile: true,
              terms: { orderBy: { version: 'desc' }, take: 1 },
            },
          },
        },
      }),
    ]);

    const lenders = await Promise.all(
      links.map(async (l) => {
        const terms = l.tenant.terms[0] ?? null;
        const accepted = terms
          ? (await this.prisma.termsAcceptance.findFirst({
              where: {
                actorId: userId,
                scope: 'tenant',
                tenantId: l.tenantId,
                tenantVersion: terms.version,
              },
            })) !== null
          : true; // nothing published → nothing to accept
        return {
          tenantId: l.tenant.id,
          name: l.tenant.name,
          primaryColor: l.tenant.primaryColor ?? DEFAULT_PRIMARY_COLOR,
          tagline: l.tenant.tagline,
          logoUrl: l.tenant.logoFile
            ? await this.files.presignGet(l.tenant.logoFile.storageKey, l.tenant.logoFile.mime)
            : null,
          termsVersion: terms?.version ?? null,
          termsAccepted: accepted,
        };
      }),
    );

    return {
      platform: {
        version: platform.version,
        body: platform.body,
        accepted: platformAccepted !== null,
      },
      lenders,
    };
  }
}
