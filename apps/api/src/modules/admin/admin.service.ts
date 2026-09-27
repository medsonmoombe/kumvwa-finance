import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TenantStatus } from '@prisma/client';
import { minorToKwacha } from '@kumvwa/core';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import type { NrcSide } from '../clients/clients.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
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
  status: TenantStatus;
  email: string | null;
  contactPerson: string | null;
  ownerNrcEncrypted: string | null;
  verificationNote: string | null;
  bozSubmittedAt: Date | null;
  createdAt: Date;
  bozFile: {
    id: string;
    kind: string;
    mime: string;
    size: number;
    createdAt: Date;
    checksum: string;
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
    private readonly files: FilesService,
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
        email: true,
        contactPerson: true,
        ownerNrcEncrypted: true,
        verificationNote: true,
        bozSubmittedAt: true,
        createdAt: true,
        // `checksum` decides "confirmed in storage" for the approval checklist.
        bozFile: {
          select: {
            id: true,
            kind: true,
            mime: true,
            size: true,
            createdAt: true,
            checksum: true,
          },
        },
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
      include: {
        bozFile: { select: { id: true, checksum: true } },
        users: {
          where: { role: 'tenant_owner' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    if (dto.decision === 'approve') {
      if (tenant.status === 'active') {
        throw new BadRequestException('Tenant is already verified');
      }
      const readiness = this.reviewReadiness(tenant);
      if (!readiness.canApprove) {
        throw new BadRequestException(
          `Cannot approve this business: ${readiness.blockers.join('; ')}`,
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
        ? {
            status: 'active', verificationNote: null,
            verificationReviewedAt: new Date(), verificationReviewedBy: adminId,
          }
        : {
            status: 'rejected', verificationNote: dto.reason!.trim(),
            verificationReviewedAt: new Date(), verificationReviewedBy: adminId,
          },
      select: {
        id: true, name: true, status: true, verificationNote: true,
        verificationReviewedAt: true, verificationReviewedBy: true,
      },
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
      reviewedAt: updated.verificationReviewedAt,
      reviewedBy: updated.verificationReviewedBy,
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

  /** Full review document for a lender business, including portfolio context. */
  async tenantDetail(tenantId: string, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        bozFile: { select: { id: true, kind: true, mime: true, size: true, createdAt: true, checksum: true } },
        files: {
          where: {
            checksum: { not: '' },
            kind: { in: ['boz_certificate', 'kyc_document', 'other'] },
          },
          select: { id: true, kind: true, mime: true, size: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        users: {
          where: { role: { in: ['tenant_owner', 'tenant_staff'] } },
          select: { id: true, displayName: true, email: true, phone: true, role: true, status: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
        products: { select: { id: true, name: true, active: true, rateBps: true, maxTerm: true } },
        clientLinks: { select: { clientId: true } },
        loans: {
          select: { id: true, loanRef: true, status: true, principal: true, totalDue: true, paidAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const reviewer = tenant.verificationReviewedBy
      ? await this.prisma.user.findUnique({
          where: { id: tenant.verificationReviewedBy },
          select: { displayName: true, email: true },
        })
      : null;

    await this.audit.record({
      actorId,
      action: 'tenant.review_detail_read',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
    });
    const outstanding = tenant.loans.reduce((sum, loan) => {
      const remaining = loan.totalDue - loan.paidAmount;
      return sum + (remaining > 0n ? remaining : 0n);
    }, 0n);
    return {
      id: tenant.id,
      name: tenant.name,
      type: tenant.type,
      status: tenant.status,
      email: tenant.email,
      address: tenant.address,
      tpin: tenant.tpin,
      contactPerson: tenant.contactPerson,
      tagline: tenant.tagline,
      verificationNote: tenant.verificationNote,
      bozSubmittedAt: tenant.bozSubmittedAt,
      bozFile: tenant.bozFile,
      attachments: tenant.files,
      review: {
        ...this.reviewReadiness(tenant),
        reviewedAt: tenant.verificationReviewedAt,
        reviewer: reviewer
          ? { name: reviewer.displayName, email: reviewer.email }
          : null,
      },
      createdAt: tenant.createdAt,
      users: tenant.users,
      products: tenant.products,
      portfolio: {
        clientCount: tenant.clientLinks.length,
        loanCount: tenant.loans.length,
        outstanding: minorToKwacha(outstanding),
        overdueCount: tenant.loans.filter((loan) => loan.status === 'overdue').length,
      },
      loans: tenant.loans.map((loan) => ({
        id: loan.id,
        loanRef: loan.loanRef,
        status: loan.status,
        principal: minorToKwacha(loan.principal),
        outstanding: minorToKwacha(
          loan.totalDue - loan.paidAmount > 0n ? loan.totalDue - loan.paidAmount : 0n,
        ),
        createdAt: loan.createdAt,
      })),
    };
  }

  /**
   * One source of truth for the decision UI and the approval endpoint: the
   * reviewer must be able to see every item below before a lender can lend.
   * `checks` drives the per-item tick list in the console; `blockers` is the
   * same information as the messages the approve endpoint refuses with.
   */
  private reviewReadiness(tenant: {
    status: TenantStatus;
    name?: string | null;
    type?: string | null;
    email?: string | null;
    contactPerson?: string | null;
    bozSubmittedAt?: Date | null;
    ownerNrcEncrypted?: string | null;
    bozFile?: { id: string; checksum: string } | null;
    users?: readonly unknown[];
  }) {
    const certificateConfirmed = tenant.bozFile
      ? tenant.bozFile.checksum !== ''
      : false;

    const checks = [
      {
        key: 'name',
        label: 'Business name',
        ok: Boolean(tenant.name?.trim()),
        blocker: 'Business name is missing',
      },
      {
        key: 'type',
        label: 'Business type',
        ok: Boolean(tenant.type?.trim()),
        blocker: 'Business type is missing',
      },
      {
        key: 'email',
        label: 'Business email',
        ok: Boolean(tenant.email?.trim()),
        blocker: 'Business email is missing',
      },
      {
        key: 'contactPerson',
        label: 'Contact person',
        ok: Boolean(tenant.contactPerson?.trim()),
        blocker: 'Contact person is missing',
      },
      {
        key: 'owner',
        label: 'Owner account',
        ok: Boolean(tenant.users?.length),
        blocker: 'A business owner account is missing',
      },
      {
        key: 'nrc',
        label: 'Owner NRC on file',
        ok: Boolean(tenant.ownerNrcEncrypted),
        blocker: 'Owner NRC is missing',
      },
      {
        key: 'submitted',
        label: 'BOZ certificate submitted',
        ok: Boolean(tenant.bozSubmittedAt),
        blocker: 'BOZ certificate has not been submitted',
      },
      {
        key: 'certificate',
        label: 'Certificate confirmed in storage',
        ok: certificateConfirmed,
        blocker: 'A confirmed BOZ certificate is required',
      },
    ];

    const blockers = checks.filter((c) => !c.ok).map((c) => c.blocker);
    if (tenant.status !== 'pending_verification') {
      blockers.unshift(
        tenant.status === 'active'
          ? 'This business is already approved'
          : tenant.status === 'rejected'
            ? 'Awaiting a corrected resubmission from the business'
            : 'This business is suspended and cannot be approved',
      );
    }
    return {
      canApprove:
        tenant.status === 'pending_verification' && blockers.length === 0,
      blockers,
      checks: checks.map(({ key, label, ok }) => ({ key, label, ok })),
    };
  }

  /** The console's platform overview band — one query per slice, parallel. */
  async stats() {
    const [tenants, clients, users, loans, outstanding, pendingVerifications] =
      await Promise.all([
        this.prisma.tenant.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.client.count(),
        this.prisma.user.count({
          where: {
            role: { in: ['platform_admin', 'tenant_owner', 'tenant_staff'] },
          },
        }),
        this.prisma.loan.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.loan.aggregate({
          where: { status: { in: ['active', 'overdue'] } },
          _sum: { totalDue: true, paidAmount: true },
        }),
        this.prisma.tenant.count({
          where: { status: 'pending_verification' },
        }),
      ]);

    const tenantCounts = Object.fromEntries(
      tenants.map((g) => [g.status, g._count._all]),
    );
    const out =
      (outstanding._sum.totalDue ?? 0n) - (outstanding._sum.paidAmount ?? 0n);

    return {
      tenants: {
        pending: tenantCounts.pending_verification ?? 0,
        active: tenantCounts.active ?? 0,
        rejected: tenantCounts.rejected ?? 0,
        suspended: tenantCounts.suspended ?? 0,
        total: tenants.reduce((a, g) => a + g._count._all, 0),
      },
      clients,
      users,
      loans: Object.fromEntries(
        loans.map((g) => [g.status, g._count._all]),
      ) as Record<string, number>,
      outstandingMinor: (out > 0n ? out : 0n).toString(),
      pendingVerifications,
    };
  }

  /** Tenant summary for the overview grid — portfolio + status per lender. */
  async tenantsWithStats() {
    const tenants = await this.listTenants();
    return Promise.all(
      tenants.map(async (t) => {
        const [loans, outstanding, clientCount] = await Promise.all([
          this.prisma.loan.groupBy({
            by: ['status'],
            where: { tenantId: t.id },
            _count: { _all: true },
          }),
          this.prisma.loan.aggregate({
            where: { tenantId: t.id, status: { in: ['active', 'overdue'] } },
            _sum: { totalDue: true, paidAmount: true },
          }),
          this.prisma.clientLenderLink.count({ where: { tenantId: t.id } }),
        ]);
        const out =
          (outstanding._sum.totalDue ?? 0n) -
          (outstanding._sum.paidAmount ?? 0n);
        return {
          ...t,
          clients: clientCount,
          loanCounts: Object.fromEntries(
            loans.map((g) => [g.status, g._count._all]),
          ) as Record<string, number>,
          outstandingMinor: (out > 0n ? out : 0n).toString(),
        };
      }),
    );
  }

  // ─────────────── platform-wide borrower oversight ───────────────

  async listClients(q?: string) {
    const term = q?.trim();
    const rows = await this.prisma.client.findMany({
      where: term
        ? {
            OR: [
              { firstName: { contains: term, mode: 'insensitive' as const } },
              { lastName: { contains: term, mode: 'insensitive' as const } },
              { phone: { contains: term } },
            ],
          }
        : undefined,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        status: true,
        lenderLinks: { select: { tenantId: true } },
        loans: { select: { status: true } },
        user: { select: { status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      items: rows.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`.trim(),
        phone: c.phone,
        email: c.email,
        status: c.status,
        lenders: c.lenderLinks.length,
        loans: c.loans.length,
        overdue: c.loans.filter((l) => l.status === 'overdue').length,
        accountStatus: c.user?.status ?? 'no_account',
      })),
    };
  }

  /**
   * Cross-platform borrower detail for the oversight drawer. A PII read —
   * audited every time (same pattern as the owner-identity reveal above).
   */
  async clientDetail(id: string, actorId: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        lenderLinks: {
          include: { tenant: { select: { id: true, name: true, status: true } } },
        },
        loans: {
          select: {
            id: true,
            tenantId: true,
            loanRef: true,
            status: true,
            principal: true,
            totalDue: true,
            paidAmount: true,
            createdAt: true,
            tenant: { select: { id: true, name: true, status: true } },
            repayments: {
              select: { id: true, amount: true, method: true, reference: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        user: { select: { status: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    await this.audit.record({
      actorId,
      action: 'pii.read',
      entity: 'Client',
      entityId: id,
      diff: { context: 'admin.client_detail' },
    });

    const outstanding = client.loans.map((l) => {
      const rest = l.totalDue - l.paidAmount;
      return {
        id: l.id,
        loanRef: l.loanRef,
        lender: l.tenant,
        status: l.status,
        createdAt: l.createdAt,
        principal: minorToKwacha(l.principal),
        outstanding: minorToKwacha(rest > 0n ? rest : 0n),
        repayments: l.repayments.map((repayment) => ({
          id: repayment.id,
          amount: minorToKwacha(repayment.amount),
          method: repayment.method,
          reference: repayment.reference,
          recordedAt: repayment.createdAt,
        })),
      };
    });

    return {
      id: client.id,
      name: `${client.firstName} ${client.lastName}`.trim(),
      phone: client.phone,
      email: client.email,
      status: client.status,
      createdAt: client.createdAt,
      nrc: client.nrcEncrypted ? this.nrc.decrypt(client.nrcEncrypted) : null,
      dob: client.dob,
      address: client.address,
      employmentStatus: client.employmentStatus,
      incomeBand: client.incomeBand,
      incomeSource: client.incomeSource,
      kinName: client.kinName,
      kinPhone: client.kinPhone,
      profileCompletedAt: client.profileCompletedAt,
      lenders: client.lenderLinks.map((l) => ({
        id: l.tenant.id,
        name: l.tenant.name,
        status: l.tenant.status,
        linkedAt: l.createdAt,
      })),
      accountStatus: client.user?.status ?? 'no_account',
      // NRC faces are stored tenant-less, so they appear in no lender's
      // attachment list — this drawer is where an admin sees them.
      documents: await this.clientDocuments(client),
      loans: outstanding,
    };
  }

  // ─────────────── platform-wide console user oversight ───────────────

  /**
   * Every stored document a borrower owns, newest uploads last, front face
   * first. Kept tiny on purpose: the admin view needs to know WHAT exists and
   * its size, not to inline the bytes.
   */
  private async clientDocuments(client: {
    nrcPhotoFileId: string | null;
    nrcBackPhotoFileId: string | null;
  }) {
    const ids = [client.nrcPhotoFileId, client.nrcBackPhotoFileId].filter(
      (id): id is string => id !== null,
    );
    if (ids.length === 0) return [];

    const rows = await this.prisma.file.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        kind: true,
        mime: true,
        size: true,
        createdAt: true,
      },
    });

    return rows
      .map((row) => ({
        ...row,
        side: (row.id === client.nrcPhotoFileId ? 'front' : 'back') as NrcSide,
      }))
      .sort((a, b) => (a.side === b.side ? 0 : a.side === 'front' ? -1 : 1));
  }

  /**
   * Platform-admin view of a borrower's NRC photo. An admin has no lender
   * link, so this is scoped by the client id alone (role-gated at the
   * controller) and audited as a PII read — same contract as ownerIdentity.
   */
  async clientNrcPhotoUrl(
    clientId: string,
    actorId: string,
    side: NrcSide = 'front',
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, nrcPhotoFileId: true, nrcBackPhotoFileId: true },
    });
    if (!client) throw new NotFoundException('Client not found');

    const fileId =
      side === 'back' ? client.nrcBackPhotoFileId : client.nrcPhotoFileId;
    if (!fileId) throw new NotFoundException(`No NRC ${side} photo on file`);

    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File missing');

    await this.audit.record({
      actorId,
      action: 'pii.read',
      entity: 'Client',
      entityId: clientId,
      diff: { field: 'nrcPhoto', side, context: 'admin.nrc_viewer' },
    });

    return { url: await this.files.presignGet(file.storageKey, file.mime) };
  }

  async listUsers() {
    const rows = await this.prisma.user.findMany({
      where: {
        role: { in: ['platform_admin', 'tenant_owner', 'tenant_staff'] },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true,
        tenant: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    });
    return {
      items: rows.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        tenantId: u.tenant?.id ?? null,
        tenantName: u.tenant?.name ?? 'Platform',
        createdAt: u.createdAt,
      })),
    };
  }

  /**
   * Disable kills every session immediately (refresh families revoked);
   * enable simply flips the flag back. Platform admins are protected — that
   * account class is the break-glass path.
   */
  async setUserStatus(
    actorId: string,
    userId: string,
    status: 'active' | 'disabled',
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true, tenantId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'platform_admin') {
      throw new ForbiddenException(
        'Platform admin accounts cannot be disabled from this console',
      );
    }
    if (user.status === status) return { id: user.id, status };

    await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
    if (status === 'disabled') {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record({
      actorId,
      action: 'admin.user_status',
      entity: 'User',
      entityId: userId,
      tenantId: user.tenantId ?? undefined,
      diff: { from: user.status, to: status },
    });
    return { id: user.id, status };
  }

  /**
   * Direct lifecycle control (approve/reject/suspend/reactivate) — used by
   * the tenant detail document. Requires a certificate before activation.
   */
  async setStatus(
    actorId: string,
    tenantId: string,
    status: TenantStatus,
  ) {
    if (!TENANT_STATUSES.includes(status)) {
      throw new BadRequestException(
        `status must be one of: ${TENANT_STATUSES.join(', ')}`,
      );
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        status: true,
        name: true,
        type: true,
        email: true,
        contactPerson: true,
        bozSubmittedAt: true,
        ownerNrcEncrypted: true,
        bozFile: { select: { id: true, checksum: true } },
        users: {
          where: { role: 'tenant_owner' },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    // Activation goes through the same checklist as the review endpoint —
    // otherwise this break-glass path could approve an incomplete file.
    if (status === 'active' && tenant.status !== 'active') {
      const readiness = this.reviewReadiness(tenant);
      if (!readiness.canApprove) {
        throw new BadRequestException(
          `Cannot activate this business: ${readiness.blockers.join('; ')}`,
        );
      }
    }

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
      select: { id: true, status: true },
    });

    await this.audit.record({
      actorId,
      action: 'admin.tenant_status',
      entity: 'Tenant',
      entityId: tenantId,
      tenantId,
      diff: { from: tenant.status, to: status },
    });

    const owner = await this.prisma.user.findFirst({
      where: { tenantId, role: 'tenant_owner' },
      select: { id: true },
    });
    if (owner) {
      await this.notify.create(
        owner.id,
        'verification',
        status === 'active'
          ? 'Your account is active'
          : `Your account is now ${status.replaceAll('_', ' ')}`,
        status === 'active'
          ? 'You can lend on Kumvwa again.'
          : 'Contact support for details.',
        { tenantId, status },
      );
    }

    return { id: updated.id, status: updated.status };
  }

  private toJson(t: AdminTenantRow) {
    const { canApprove, blockers } = this.reviewReadiness(t);

    return {
      id: t.id,
      name: t.name,
      type: t.type,
      status: t.status,
      verificationNote: t.verificationNote,
      bozSubmittedAt: t.bozSubmittedAt,
      // The ETag/checksum stays server-side; the queue only needs the summary.
      bozFile: t.bozFile
        ? {
            id: t.bozFile.id,
            kind: t.bozFile.kind,
            mime: t.bozFile.mime,
            size: t.bozFile.size,
            createdAt: t.bozFile.createdAt,
          }
        : null,
      ownerPhone: t.users[0]?.phone ?? null,
      ownerName: t.users[0]?.displayName ?? null,
      /** Lets the queue disable "Approve" for an incomplete application. */
      review: { canApprove, blockers },
      createdAt: t.createdAt,
    };
  }
}
