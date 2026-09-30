import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  buildSchedule,
  firstDueDateFrom,
  kwachaToMinor,
  minorToKwacha,
  originationFee,
  type Frequency,
} from '@kumvwa/core';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PolicyService } from '../policy/policy.service';
import type {
  ApproveRequestDto,
  CreateLoanRequestDto,
  RejectRequestDto,
} from './dto/loan-requests.dto';

type Claims = {
  role?: string | null;
  tenantId?: string | null;
  clientId?: string | null;
};

@Injectable()
export class LoanRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: PolicyService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─────────────── client: create ───────────────

  async create(clientId: string, dto: CreateLoanRequestDto) {
    const link = await this.prisma.clientLenderLink.findUnique({
      where: { clientId_tenantId: { clientId, tenantId: dto.lenderId } },
    });
    if (!link) throw new NotFoundException('Lender not linked to your profile');

    // Only VERIFIED tenants receive requests (BOZ gate, same as lending).
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.lenderId },
    });
    if (!tenant || tenant.status !== 'active') {
      throw new ForbiddenException(
        'This lender is not currently accepting requests',
      );
    }

    if (dto.termCount > this.env.REQUEST_MAX_TERM) {
      throw new BadRequestException(
        `Maximum repayment term is ${this.env.REQUEST_MAX_TERM} months`,
      );
    }

    // ── Server-enforced credit policy (the app only displays it) ──
    // The ladder is per-lender; hard blocks (overdue/defaulted) are platform-wide.
    // Refusal reads blockedReason — NOT tier — because a pending application
    // resolves with the borrower's real tier AND blockedReason set (the banner
    // keeps showing capacity; only the submit is gated).
    const resolution = await this.policy.resolve(clientId, dto.lenderId);
    const amountMinor = kwachaToMinor(dto.amount);

    if (resolution.blockedReason) {
      throw new ForbiddenException(
        resolution.blockedReason,
      );
    }
    if (amountMinor < kwachaToMinor(this.env.REQUEST_MIN_KWACHA)) {
      throw new BadRequestException(
        `Minimum request is K${this.env.REQUEST_MIN_KWACHA}`,
      );
    }
    if (amountMinor > kwachaToMinor(resolution.limitKwacha)) {
      throw new ForbiddenException(
        `Amount above your limit of K${resolution.limitKwacha}`,
      );
    }
    if (dto.termCount > resolution.maxTermMonths) {
      throw new ForbiddenException(
        `Maximum repayment term for your tier is ${resolution.maxTermMonths} months`,
      );
    }

    const request = await this.prisma.loanRequest.create({
      data: {
        tenantId: dto.lenderId,
        clientId,
        amount: amountMinor,
        termCount: dto.termCount,
        purpose: dto.purpose.trim(),
      },
    });

    const owner = await this.prisma.user.findFirst({
      where: { tenantId: dto.lenderId, role: 'tenant_owner' },
    });
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (owner && client) {
      await this.notify.create(
        owner.id,
        'loan_request',
        'New loan request',
        `${client.firstName} ${client.lastName} requested ` +
          `K${minorToKwacha(amountMinor)} over ${dto.termCount} months. ` +
          'Review it in Loan Requests.',
        { requestId: request.id },
      );
    }

    await this.audit.record({
      actorId: clientId,
      action: 'loan_request.create',
      description: `Client submitted a loan request for K${minorToKwacha(amountMinor)} over ${dto.termCount} months`,
      entity: 'LoanRequest',
      entityId: request.id,
      tenantId: dto.lenderId,
      diff: {
        amountMinor: amountMinor.toString(),
        termCount: dto.termCount,
        tier: resolution.tier,
        policyVersion: resolution.policyVersion,
      },
    });

    return {
      id: request.id,
      status: request.status,
      amount: dto.amount,
      termCount: dto.termCount,
      lenderName: tenant.name,
    };
  }

  // ─────────────── reads (role-scoped) ───────────────

  async list(claims: Claims, status?: string) {
    const where =
      claims.role === 'client'
        ? {
            clientId: claims.clientId!,
            ...(status ? { status: status as never } : {}),
          }
        : {
            tenantId: claims.tenantId!,
            ...(status ? { status: status as never } : {}),
          };

    const rows = await this.prisma.loanRequest.findMany({
      where,
      include: {
        client: { select: {
          firstName: true, lastName: true, phone: true,
          profileCompletedAt: true, employmentStatus: true, educationLevel: true,
          incomeBand: true, kinName: true, kinPhone: true, kin2Name: true, kin2Phone: true,
        } },
        tenant: { select: { name: true } },
        loan: { select: { id: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], // pending first
      take: 100,
    });

    return { items: rows.map((r) => this.toJson(r)) };
  }

  async get(claims: Claims, id: string) {
    const r = await this.prisma.loanRequest.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            firstName: true, lastName: true, phone: true,
            profileCompletedAt: true,
            employmentStatus: true, educationLevel: true,
            incomeBand: true, kinName: true, kinPhone: true, kin2Name: true, kin2Phone: true,
          },
        },
        tenant: { select: { name: true } },
        loan: { select: { id: true } },
      },
    });
    if (!r) throw new NotFoundException('Request not found');
    if (claims.role === 'client' && r.clientId !== claims.clientId) {
      throw new NotFoundException('Request not found');
    }
    if (claims.role !== 'client' && r.tenantId !== claims.tenantId) {
      throw new NotFoundException('Request not found');
    }
    return this.toJson(r);
  }

  private toJson(r: {
    id: string;
    clientId: string;
    client: {
      firstName: string; lastName: string; phone: string;
      profileCompletedAt?: Date | null; employmentStatus?: string | null;
      educationLevel?: string | null; incomeBand?: string | null;
      kinName?: string | null; kinPhone?: string | null;
      kin2Name?: string | null; kin2Phone?: string | null;
    };
    tenantId: string;
    tenant: { name: string };
    amount: bigint;
    termCount: number;
    purpose: string;
    status: string;
    feedback: string | null;
    loan: { id: string } | null;
    createdAt: Date;
    reviewedAt: Date | null;
  }) {
    return {
      id: r.id,
      clientId: r.clientId,
      clientName: `${r.client.firstName} ${r.client.lastName}`.trim(),
      phone: r.client.phone,
      clientProfile: {
        completedAt: r.client.profileCompletedAt ?? null,
        employmentStatus: r.client.employmentStatus ?? null,
        educationLevel: r.client.educationLevel ?? null,
        incomeBand: r.client.incomeBand ?? null,
        nextOfKinName: r.client.kinName ?? null,
        nextOfKinPhone: r.client.kinPhone ?? null,
        secondNextOfKinName: r.client.kin2Name ?? null,
        secondNextOfKinPhone: r.client.kin2Phone ?? null,
      },
      lenderId: r.tenantId,
      lenderName: r.tenant.name,
      amount: minorToKwacha(r.amount),
      amountMinor: r.amount.toString(),
      termCount: r.termCount,
      purpose: r.purpose,
      status: r.status,
      feedback: r.feedback,
      loanId: r.loan?.id ?? null,
      requestedAt: r.createdAt,
      reviewedAt: r.reviewedAt,
    };
  }

  // ─────────────── lender: approve ───────────────

  /** `LN-YYYY-00001` — sequential per calendar year, unique per lender.
   *  Computed inside the tx so the number is picked under the same
   *  transaction that creates the loan; the unique index backs it up. */
  private async nextLoanRef(tx: {
    loan: {
      count(args: {
        where: { loanRef: { startsWith: string } };
      }): Promise<number>;
    };
  }): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `LN-${year}-`;
    const count = await tx.loan.count({
      where: { loanRef: { startsWith: prefix } },
    });
    return `${prefix}${String(count + 1).padStart(5, '0')}`;
  }

  async approve(
    tenantId: string,
    actorId: string,
    requestId: string,
    dto: ApproveRequestDto,
  ) {
    // Serialize concurrent reviews on this request.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LoanRequest" WHERE id = ${requestId} FOR UPDATE`;

      const r = await tx.loanRequest.findUnique({ where: { id: requestId } });
      if (!r || r.tenantId !== tenantId) {
        throw new NotFoundException('Request not found');
      }
      if (r.status !== 'pending') {
        throw new ConflictException('Request already reviewed');
      }

      const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant || tenant.status !== 'active') {
        throw new ForbiddenException('Tenant verification required');
      }

      // Product terms (first active product when none pinned) supply the
      // M4 knobs: frequency, origination fee, penalty settings.
      const product = dto.productId
        ? await tx.loanProduct.findFirst({
            where: { id: dto.productId, tenantId },
          })
        : await tx.loanProduct.findFirst({
            where: { tenantId, active: true },
            orderBy: { createdAt: 'asc' },
          });

      const fee = originationFee(
        r.amount,
        product?.originationFeeBps ?? 0,
        (product?.feeTreatment as 'add' | 'deduct') ?? 'add',
      );
      const frequency = ((dto.frequency ?? product?.frequency ??
        'monthly') as Frequency) satisfies Frequency;

      // M5 repayment structure: the product's, else the platform default.
      // Products default to 'bullet' (one lump at maturity); existing
      // amortizing products stay 'installments' via their own column.
      const structure = (product?.repaymentStructure ??
        'bullet') as 'installments' | 'bullet';

      // The schedule is anchored to the day the money is released, so a
      // `termCount`-month loan matures exactly `termCount` calendar months
      // later. Anchor it to a fixed day-of-month instead and a 1-month term
      // lands wherever that date happens to fall — up to a month early or late.
      const disbursedAt = new Date();
      const schedule = buildSchedule({
        principalMinor: r.amount,
        rateBps: dto.rateBps,
        termCount: r.termCount,
        firstDueDate: firstDueDateFrom(disbursedAt, frequency),
        frequency,
        feeMinor: fee.feeMinor,
        structure,
      });

      const loan = await tx.loan.create({
        data: {
          tenantId,
          clientId: r.clientId,
          productId: dto.productId ?? null,
          loanRef: await this.nextLoanRef(tx),
          repaymentStructure: structure,
          principal: r.amount,
          rateBps: dto.rateBps,
          termCount: r.termCount,
          frequency,
          feeMinor: fee.feeMinor,
          disbursementMinor: fee.disbursementMinor,
          totalDue: schedule.totalDueMinor,
          status: 'active',
          disbursedAt,
          installments: {
            create: schedule.installments.map((i) => ({
              seq: i.seq,
              dueDate: i.dueDate,
              amount: i.amountMinor,
            })),
          },
        },
      });

      await tx.loanRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedBy: actorId,
          reviewedAt: new Date(),
          loanId: loan.id,
        },
      });

      return { loanId: loan.id, clientId: r.clientId };
    });

    // Post-tx: notify + audit (never roll back the money event).
    const clientUser = await this.prisma.user.findFirst({
      where: { clientId: result.clientId, role: 'client' },
    });
    if (clientUser) {
      await this.notify.create(
        clientUser.id,
        'request_approved',
        'Loan request approved',
        'Your loan request was approved. Your loan is now active.',
        { requestId, loanId: result.loanId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'loan_request.approve',
      description: `Loan request approved — loan created at ${dto.rateBps / 100}% per month`,
      entity: 'LoanRequest',
      entityId: requestId,
      tenantId,
      diff: { loanId: result.loanId, rateBps: dto.rateBps },
    });

    return { status: 'approved' as const, loanId: result.loanId };
  }

  // ─────────────── lender: reject ───────────────

  async reject(
    tenantId: string,
    actorId: string,
    requestId: string,
    dto: RejectRequestDto,
  ) {
    const r = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LoanRequest" WHERE id = ${requestId} FOR UPDATE`;
      const row = await tx.loanRequest.findUnique({ where: { id: requestId } });
      if (!row || row.tenantId !== tenantId) {
        throw new NotFoundException('Request not found');
      }
      if (row.status !== 'pending') {
        throw new ConflictException('Request already reviewed');
      }

      return tx.loanRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          feedback: dto.feedback.trim(),
          reviewedBy: actorId,
          reviewedAt: new Date(),
        },
      });
    });

    const clientUser = await this.prisma.user.findFirst({
      where: { clientId: r.clientId, role: 'client' },
    });
    if (clientUser) {
      await this.notify.create(
        clientUser.id,
        'request_rejected',
        'Loan request declined',
        'Your loan request was declined. Open the app to read the feedback.',
        { requestId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'loan_request.reject',
      description: `Loan request declined: "${dto.feedback.trim()}"`,
      entity: 'LoanRequest',
      entityId: requestId,
      tenantId,
      diff: { feedback: dto.feedback.trim() },
    });

    return { status: 'rejected' as const };
  }
}
