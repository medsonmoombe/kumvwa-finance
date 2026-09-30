import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DEFAULT_PRIMARY_COLOR } from '../terms/terms.service';
import type {
  ResubmitVerificationDto,
  SubmitVerificationDto,
  UpdateApplicationDto,
  UpdateBrandingDto,
} from './dto/tenants.dto';

/** Hand-written structural row type — house style (see LoanRequestsService). */
type TenantRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  verificationNote: string | null;
  email: string | null;
  address: string | null;
  tpin: string | null;
  contactPerson: string | null;
  businessDescription: string | null;
  reviewEvents: Array<{
    id: string;
    action: string;
    note: string | null;
    changes: unknown;
    createdAt: Date;
    actor: { displayName: string; role: string } | null;
  }>;
  bozSubmittedAt: Date | null;
  createdAt: Date;
  bozFile: {
    id: string;
    kind: string;
    mime: string;
    size: number;
    createdAt: Date;
  } | null;
};

/** The bozFile projection is repeated in the select and the row type. */
export const BOZ_FILE_SELECT = {
  select: {
    id: true,
    kind: true,
    mime: true,
    size: true,
    createdAt: true,
  },
} as const;

const TENANT_SELECT = {
  id: true,
  name: true,
  type: true,
  status: true,
  verificationNote: true,
  email: true,
  address: true,
  tpin: true,
  contactPerson: true,
  businessDescription: true,
  reviewEvents: {
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      action: true,
      note: true,
      changes: true,
      createdAt: true,
      actor: { select: { displayName: true, role: true } },
    },
  },
  bozSubmittedAt: true,
  createdAt: true,
  bozFile: BOZ_FILE_SELECT,
} as const;

/**
 * The tenant (lender business) profile + BOZ verification journey. The
 * console reads `status` on boot to decide between the onboarding gate and
 * the dashboard.
 */
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly nrc: NrcCryptoService,
    private readonly files: FilesService,
  ) {}

  async me(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: TENANT_SELECT,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.toJson(tenant);
  }

  /**
   * Step 1 of the BOZ gate: the owner uploads a certificate + their NRC and
   * the tenant enters `pending_verification` for admin review. Already-active
   * tenants can't re-submit — that would un-verify a live lending account.
   */
  async submitVerification(
    tenantId: string,
    actorId: string,
    dto: SubmitVerificationDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status === 'active') {
      throw new BadRequestException('This business is already verified');
    }
    if (tenant.status === 'suspended') {
      throw new BadRequestException(
        'This account is suspended — contact Kumvwa support',
      );
    }

    const file = await this.prisma.file.findUnique({
      where: { id: dto.fileId },
    });
    // 404 (not 403) so file ids can't be probed across tenants.
    if (!file || file.tenantId !== tenantId) {
      throw new NotFoundException('Uploaded file not found');
    }
    if (file.kind !== 'boz_certificate') {
      throw new BadRequestException(
        'Only a Bank of Zambia certificate can be submitted for verification',
      );
    }
    if (file.checksum === '') {
      throw new BadRequestException(
        'Confirm the upload (POST /files/:id/confirm) before submitting',
      );
    }

    // A confirmed row can still point at bytes that are gone (bucket reset,
    // lifecycle cleanup). Re-check storage so a submission is never empty and
    // the reviewer never opens a dead link.
    await this.files.assertObjectPresent(file.storageKey);

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        // The FK (`File.bozCertOfId`) lives on File, so this is a relation
        // connect rather than a scalar write. Re-submitting re-points it.
        bozFile: { connect: { id: file.id } },
        bozSubmittedAt: new Date(),
        status: 'pending_verification',
        verificationNote: null, // clear any previous rejection reason
        verificationReviewedAt: null,
        verificationReviewedBy: null,
        ownerNrcEncrypted: this.nrc.encrypt(dto.ownerNrc.trim()),
      },
      select: TENANT_SELECT,
    });

    // Tell the review team there's something waiting on them.
    const admins = await this.prisma.user.findMany({
      where: { role: 'platform_admin' },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.notify.create(
        admin.id,
        'verification',
        'BOZ certificate submitted',
        `${tenant.name} submitted their certificate for review.`,
        { tenantId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'tenant.verification_submit',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      // Never log the NRC itself — the fact that one was supplied is enough.
      diff: { fileId: file.id, ownerNrcSupplied: true },
    });
    await this.prisma.tenantReviewEvent.create({
      data: {
        tenantId,
        actorId,
        action: 'evidence_submitted',
        note: 'An optional BOZ certificate was attached to the application.',
        changes: { fileId: file.id },
      },
    });

    if (tenant.status === 'rejected') {
      await this.prisma.tenantReviewEvent.create({
        data: {
          tenantId,
          actorId,
          action: 'resubmitted',
          note: 'Business application resubmitted for review with updated evidence.',
        },
      });
    }

    // Read again so clients receive the just-created immutable timeline events.
    return this.me(tenantId);
  }

  /** A rejected lender can return to the review queue without a BOZ upload. */
  async resubmitVerification(
    tenantId: string,
    actorId: string,
    dto: ResubmitVerificationDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    if (tenant.status !== 'rejected') {
      throw new BadRequestException(
        'Only a rejected business can be resubmitted for review',
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'pending_verification',
        verificationNote: null,
        verificationReviewedAt: null,
        verificationReviewedBy: null,
        ownerNrcEncrypted: this.nrc.encrypt(dto.ownerNrc.trim()),
      },
      select: TENANT_SELECT,
    });

    const admins = await this.prisma.user.findMany({
      where: { role: 'platform_admin' },
      select: { id: true },
    });
    for (const admin of admins) {
      await this.notify.create(
        admin.id,
        'verification',
        'Business application resubmitted',
        `${tenant.name} resubmitted their application for review.`,
        { tenantId },
      );
    }
    await this.audit.record({
      actorId,
      action: 'tenant.verification_resubmit',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      diff: { ownerNrcSupplied: true, bozFileReplaced: false },
    });
    await this.prisma.tenantReviewEvent.create({
      data: {
        tenantId,
        actorId,
        action: 'resubmitted',
        note: 'Business application resubmitted for review.',
      },
    });
    return this.me(tenantId);
  }

  /** Rejected lenders can correct their complete business application. */
  async updateRejectedApplication(
    tenantId: string,
    actorId: string,
    dto: UpdateApplicationDto,
  ) {
    const existing = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundException('Tenant not found');
    if (existing.status !== 'rejected') {
      throw new BadRequestException(
        'Business details can only be edited while the application is rejected',
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: dto.businessName.trim(),
        type: dto.businessType,
        email: dto.email.trim().toLowerCase(),
        address: dto.address?.trim() || null,
        tpin: dto.tpin.trim(),
        contactPerson: dto.contactPerson.trim(),
        businessDescription: dto.businessDescription.trim(),
      },
      select: TENANT_SELECT,
    });
    await this.audit.record({
      actorId,
      action: 'tenant.application_update',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      diff: {
        fields: [
          'businessName',
          'businessType',
          'email',
          'address',
          'tpin',
          'contactPerson',
          'businessDescription',
        ],
      },
    });
    await this.prisma.tenantReviewEvent.create({
      data: {
        tenantId,
        actorId,
        action: 'application_updated',
        note: 'Business application details were updated before resubmission.',
        changes: {
          fields: [
            'businessName',
            'businessType',
            'email',
            'address',
            'tpin',
            'contactPerson',
            'businessDescription',
          ],
        },
      },
    });
    return this.me(tenantId);
  }

  /**
   * Branding + business info. Same shape as `publicInfo` so the console's
   * live preview can reuse the public endpoint verbatim.
   */
  async updateBranding(
    tenantId: string,
    actorId: string,
    dto: UpdateBrandingDto,
  ) {
    const data: Prisma.TenantUpdateInput = {};
    if (dto.primaryColor !== undefined) data.primaryColor = dto.primaryColor;
    if (dto.tagline !== undefined) data.tagline = dto.tagline;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.tpin !== undefined) data.tpin = dto.tpin;
    if (dto.contactPerson !== undefined) data.contactPerson = dto.contactPerson;
    if (dto.businessDescription !== undefined) {
      data.businessDescription = dto.businessDescription;
    }
    if (dto.logoFileId !== undefined) {
      const f = await this.prisma.file.findUnique({
        where: { id: dto.logoFileId },
      });
      if (
        !f ||
        f.tenantId !== tenantId ||
        f.kind !== 'tenant_logo' ||
        f.checksum === ''
      ) {
        throw new BadRequestException('Logo must be an uploaded tenant_logo file');
      }
      data.logoFile = { connect: { id: f.id } };
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    await this.audit.record({
      actorId,
      action: 'tenant.branding_update',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      diff: dto,
    });

    return {
      name: updated.name,
      primaryColor: updated.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      tagline: updated.tagline,
    };
  }

  /**
   * Public: powers the invite flow + first-login branding. Terms body is
   * included so the client sees the lender's terms before signing in.
   */
  /**
   * Authenticated branding view for the console settings screen: the public
   * projection PLUS the private business-info fields the owner may edit.
   * (The public endpoint deliberately omits email/tpin/contact.)
   */
  async privateBranding(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({
      // A lender becomes discoverable to borrowers only after approval.
      where: { id: tenantId, status: 'active' },
      include: {
        logoFile: true,
        terms: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
    if (!t) throw new NotFoundException('Tenant not found');
    return {
      name: t.name,
      email: t.email,
      address: t.address,
      tpin: t.tpin,
      contactPerson: t.contactPerson,
      businessDescription: t.businessDescription,
      tagline: t.tagline,
      primaryColor: t.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      logoUrl: t.logoFile
        ? await this.files.presignGet(t.logoFile.storageKey, t.logoFile.mime)
        : null,
      terms: t.terms[0]
        ? { version: t.terms[0].version, body: t.terms[0].body }
        : null,
    };
  }

  async publicInfo(tenantId: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        logoFile: true,
        terms: { orderBy: { version: 'desc' }, take: 1 },
        // First active product so the client's apply screen can show the
        // lender's real rate/fee/term in the live breakdown before applying.
        products: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!t) throw new NotFoundException('Business not found');
    const p = t.products[0];
    return {
      name: t.name,
      tagline: t.tagline,
      businessDescription: t.businessDescription,
      primaryColor: t.primaryColor ?? DEFAULT_PRIMARY_COLOR, // Kumvwa default
      logoUrl: t.logoFile
        ? await this.files.presignGet(t.logoFile.storageKey, t.logoFile.mime)
        : null,
      terms: t.terms[0]
        ? { version: t.terms[0].version, body: t.terms[0].body }
        : null,
      product: p
        ? {
            id: p.id,
            name: p.name,
            ratePct: p.rateBps / 100,
            feePct: p.originationFeeBps / 100,
            maxTermMonths: p.maxTerm,
            frequency: p.frequency,
            repaymentStructure: p.repaymentStructure,
          }
        : null,
    };
  }

  private toJson(t: TenantRow) {
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      verificationNote: t.verificationNote,
      email: t.email,
      address: t.address,
      tpin: t.tpin,
      contactPerson: t.contactPerson,
      businessDescription: t.businessDescription,
      reviewHistory: t.reviewEvents.map((event) => ({
        id: event.id,
        action: event.action,
        note: event.note,
        changes: event.changes,
        createdAt: event.createdAt,
        actor: event.actor
          ? { name: event.actor.displayName, role: event.actor.role }
          : null,
      })),
      rejectionCount: t.reviewEvents.filter(
        (event) => event.action === 'rejected',
      ).length,
      bozSubmittedAt: t.bozSubmittedAt,
      bozFile: t.bozFile,
      createdAt: t.createdAt,
    };
  }
}
