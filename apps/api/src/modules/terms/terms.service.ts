import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import {
  DEFAULT_LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_KINDS,
  LEGAL_DOCUMENT_TITLES,
  type LegalDocumentKind,
} from './legal-documents';

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

  /**
   * Idempotent bootstrap — v1 of each document exists before any registration.
   *
   * A database is only ever missing one of these if it was created before the
   * document existed, so an existing version 1 is never overwritten: that would
   * silently change terms a user had already accepted.
   */
  async onModuleInit(): Promise<void> {
    await Promise.all(
      LEGAL_DOCUMENT_KINDS.map((kind) =>
        // Upsert on the (kind, version) key rather than find-then-create: two
        // API instances booting at the same time both see the row missing, and
        // the loser of that race would fail startup on the unique constraint.
        // `update: {}` keeps the guarantee that an existing version 1 body is
        // never rewritten.
        this.prisma.platformTerms.upsert({
          where: { kind_version: { kind, version: 1 } },
          create: { kind, version: 1, body: DEFAULT_LEGAL_DOCUMENTS[kind] },
          update: {},
        }),
      ),
    );
  }

  documentTitle(kind: LegalDocumentKind) {
    return LEGAL_DOCUMENT_TITLES[kind];
  }

  platformLatest(kind: LegalDocumentKind = 'terms') {
    return this.prisma.platformTerms.findFirst({
      where: { kind },
      orderBy: { version: 'desc' },
    });
  }

  /** Version list for the admin history view. */
  platformHistory(kind: LegalDocumentKind) {
    return this.prisma.platformTerms.findMany({
      where: { kind },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, publishedAt: true },
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

  /**
   * Platform admins publish a new version of a legal document.
   *
   * Always a new version rather than an edit, because `TermsAcceptance` rows
   * reference the version a user agreed to; mutating a published body would
   * make the recorded acceptance a lie.
   */
  async publishPlatformDocument(
    actorId: string,
    kind: LegalDocumentKind,
    body: string,
  ) {
    const latest = await this.platformLatest(kind);
    const created = await this.prisma.platformTerms.create({
      data: { kind, version: (latest?.version ?? 0) + 1, body: body.trim() },
    });
    await this.audit.record({
      actorId,
      action: 'terms.publish_platform',
      entity: 'PlatformTerms',
      entityId: created.id,
      diff: { kind, version: created.version },
    });
    return { kind, version: created.version };
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
