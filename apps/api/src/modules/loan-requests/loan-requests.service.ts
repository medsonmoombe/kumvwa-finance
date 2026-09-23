import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildSchedule, kwachaToMinor, minorToKwacha } from '@kumvwa/core';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RiskService } from '../risk/risk.service';
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
    private readonly risk: RiskService,
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

    // ── Server-enforced credit limit (the app only displays it) ──
    const profile = await this.risk.computeProfile(clientId);
    const amountMinor = kwachaToMinor(dto.amount);
    const limitMinor = kwachaToMinor(profile.limitKwacha);

    if (amountMinor < kwachaToMinor(this.env.REQUEST_MIN_KWACHA)) {
      throw new BadRequestException(
        `Minimum request is K${this.env.REQUEST_MIN_KWACHA}`,
      );
    }
    if (amountMinor > limitMinor) {
      throw new ForbiddenException(
        `Amount above your limit of K${profile.limitKwacha}`,
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
      entity: 'LoanRequest',
      entityId: request.id,
      tenantId: dto.lenderId,
      diff: {
        amountMinor: amountMinor.toString(),
        termCount: dto.termCount,
        scoreAtRequest: profile.score,
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
        client: { select: { firstName: true, lastName: true, phone: true } },
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
        client: { select: { firstName: true, lastName: true, phone: true } },
        tenant: { select: { name: true } },
        loan: { select: { id: true } },
      },
    });
    if (!r) throw new NotFoundException('Request not found');
    // Object-level isolation: 404 (never 403) when it isn't yours.
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
    client: { firstName: string; lastName: string; phone: string };
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

      const schedule = buildSchedule({
        principalMinor: r.amount,
        rateBps: dto.rateBps,
        termCount: r.termCount,
        firstDueDate: new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth() + 1,
            12,
          ),
        ),
      });

      const loan = await tx.loan.create({
        data: {
          tenantId,
          clientId: r.clientId,
          productId: dto.productId ?? null,
          principal: r.amount,
          rateBps: dto.rateBps,
          termCount: r.termCount,
          totalDue: schedule.totalDueMinor,
          status: 'active',
          disbursedAt: new Date(),
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
        'Your loan request was approved and is now active. ' +
          'Open My Loans to see the schedule.',
        { requestId, loanId: result.loanId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'loan_request.approve',
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
        'Your loan request was declined. Open My loan requests to read ' +
          "the lender's feedback.",
        { requestId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'loan_request.reject',
      entity: 'LoanRequest',
      entityId: requestId,
      tenantId,
      diff: { feedback: dto.feedback.trim() },
    });

    return { status: 'rejected' as const };
  }
}
