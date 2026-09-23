import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TenantStatus } from '@prisma/client';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BOZ_FILE_SELECT } from '../tenants/tenants.service';
import type { ReviewVerificationDto } from './dto/admin.dto';

const TENANT_STATUSES: TenantStatus[] = [
  'pending_verification',
  'active',
  'rejected',
  'suspended',
];

type AdminTenantRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  verificationNote: string | null;
  bozSubmittedAt: Date | null;
  createdAt: Date;
  bozFile: {
    id: string;
    kind: string;
    mime: string;
    size: number;
    createdAt: Date;
  } | null;
  users: { phone: string; displayName: string }[];
};

/** Platform-operator surface: the BOZ verification queue. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly nrc: NrcCryptoService,
  ) {}

  /** Newest first. Pending tenants surface through the default sort anyway. */
  async listTenants(status?: string) {
    if (status && !TENANT_STATUSES.includes(status as TenantStatus)) {
      throw new BadRequestException(
        `status must be one of: ${TENANT_STATUSES.join(', ')}`,
      );
    }

    const rows = await this.prisma.tenant.findMany({
      where: status ? { status: status as TenantStatus } : undefined,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        verificationNote: true,
        bozSubmittedAt: true,
        createdAt: true,
        bozFile: BOZ_FILE_SELECT,
        users: {
          where: { role: 'tenant_owner' },
          select: { phone: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return rows.map((r) => this.toJson(r as AdminTenantRow));
  }

  /**
   * Approve activates lending immediately; reject stores the reason and the
   * owner sees it on their pending screen. Only an already-`active` tenant is
   * refused — a rejection can be overridden by a later approval.
   */
  async review(
    adminId: string,
    tenantId: string,
    dto: ReviewVerificationDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, status: true, bozSubmittedAt: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (dto.decision === 'approve') {
      if (tenant.status === 'active') {
        throw new BadRequestException('Tenant is already verified');
      }
      if (!tenant.bozSubmittedAt) {
        throw new BadRequestException(
          'Tenant has not submitted a certificate yet',
        );
      }
    } else if (!dto.reason) {
      throw new BadRequestException(
        'A rejection reason is required — the owner will read it',
      );
    }

    const approve = dto.decision === 'approve';
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: approve
        ? { status: 'active', verificationNote: null }
        : { status: 'rejected', verificationNote: dto.reason!.trim() },
      select: { id: true, name: true, status: true, verificationNote: true },
    });

    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: 'tenant_owner' },
      select: { id: true },
    });
    if (owner) {
      await this.notify.create(
        owner.id,
        'verification',
        approve ? 'BOZ verification approved' : 'BOZ verification rejected',
        approve
          ? 'Your business is verified — you can now lend on Kumvwa.'
          : `Your certificate was not accepted: ${updated.verificationNote}`,
        { tenantId, decision: dto.decision },
      );
    }

    await this.audit.record({
      actorId: adminId,
      action: approve ? 'tenant.verification_approve' : 'tenant.verification_reject',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      diff: { decision: dto.decision, reason: dto.reason ?? null },
    });

    return {
      id: updated.id,
      name: updated.name,
      status: updated.status,
      verificationNote: updated.verificationNote,
    };
  }

  /**
   * Reveals the owner's NRC so the reviewer can check it against the
   * certificate. Decryption is a PII read → audited every time.
   */
  async ownerIdentity(adminId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, ownerNrcEncrypted: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    await this.audit.record({
      actorId: adminId,
      action: 'pii.read',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      diff: { field: 'ownerNrc' },
    });

    return {
      tenantId: tenant.id,
      name: tenant.name,
      ownerNrc: tenant.ownerNrcEncrypted
        ? this.nrc.decrypt(tenant.ownerNrcEncrypted)
        : null,
    };
  }

  private toJson(t: AdminTenantRow) {
    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      verificationNote: t.verificationNote,
      bozSubmittedAt: t.bozSubmittedAt,
      bozFile: t.bozFile,
      ownerPhone: t.users[0]?.phone ?? null,
      ownerName: t.users[0]?.displayName ?? null,
      createdAt: t.createdAt,
    };
  }
}
