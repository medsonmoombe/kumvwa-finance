import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LoanStatus } from '@prisma/client';
import { allocateRepayment, kwachaToMinor, minorToKwacha } from '@kumvwa/core';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RecordRepaymentDto } from './dto/loans.dto';

const LOAN_STATUSES: LoanStatus[] = [
  'active',
  'overdue',
  'cleared',
  'defaulted',
];

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  // ─────────────── client: multi-lender view ───────────────

  /** Client-facing loan reads (multi-lender view), soonest due first. */
  async myLoans(clientId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { clientId },
      include: {
        tenant: { select: { id: true, name: true } },
        installments: { orderBy: { seq: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: loans
        .map((l) => {
          const outstanding = l.totalDue - l.paidAmount;
          const next = l.installments.find(
            (i) => i.status === 'overdue' || i.status === 'pending',
          );
          const overdueCount = l.installments.filter(
            (i) => i.status === 'overdue',
          ).length;
          return {
            id: l.id,
            lenderId: l.tenant.id,
            lenderName: l.tenant.name,
            principal: Number(l.principal) / 100,
            principalMinor: l.principal.toString(),
            rateBps: l.rateBps,
            termCount: l.termCount,
            totalDue: Number(l.totalDue) / 100,
            totalDueMinor: l.totalDue.toString(),
            paid: Number(l.paidAmount) / 100,
            paidMinor: l.paidAmount.toString(),
            outstanding: Number(outstanding) / 100,
            outstandingMinor: outstanding.toString(),
            status: l.status,
            disbursedAt: l.disbursedAt,
            overdueCount,
            nextDueDate: next?.dueDate ?? null,
            nextDueAmountMinor: next?.amount.toString() ?? null,
            installments: l.installments.map((i) => ({
              seq: i.seq,
              dueDate: i.dueDate,
              amountMinor: i.amount.toString(),
              paidMinor: i.paidAmount.toString(),
              status: i.status,
              paidAt: i.paidAt,
            })),
          };
        })
        .sort(
          (a, b) =>
            (a.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (b.nextDueDate?.getTime() ?? Number.MAX_SAFE_INTEGER),
        ),
    };
  }

  // ─────────────── lender: portfolio list ───────────────

  async listForTenant(tenantId: string, status?: string, q?: string) {
    if (status && !LOAN_STATUSES.includes(status as LoanStatus)) {
      throw new BadRequestException(
        `status must be one of: ${LOAN_STATUSES.join(', ')}`,
      );
    }
    const term = q?.trim();

    const rows = await this.prisma.loan.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as LoanStatus } : {}),
        ...(term
          ? {
              OR: [
                { id: { contains: term, mode: 'insensitive' as const } },
                {
                  client: {
                    OR: [
                      { firstName: { contains: term, mode: 'insensitive' as const } },
                      { lastName: { contains: term, mode: 'insensitive' as const } },
                      { phone: { contains: term } },
                    ],
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        // Only the next unpaid installment — that's all the list row shows.
        installments: {
          where: { status: { not: 'paid' } },
          orderBy: { dueDate: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return { items: rows.map((l) => this.toListJson(l)) };
  }

  async getForTenant(tenantId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        client: { select: { firstName: true, lastName: true, phone: true } },
        product: { select: { id: true, name: true } },
        installments: { orderBy: { seq: 'asc' } },
      },
    });
    // 404 (never 403) so loan ids can't be probed across tenants.
    if (!loan || loan.tenantId !== tenantId) {
      throw new NotFoundException('Loan not found');
    }

    const outstanding = loan.totalDue - loan.paidAmount;
    return {
      id: loan.id,
      clientId: loan.clientId,
      clientName: `${loan.client.firstName} ${loan.client.lastName}`.trim(),
      clientPhone: loan.client.phone,
      productName: loan.product?.name ?? null,
      status: loan.status,
      rateBps: loan.rateBps,
      termCount: loan.termCount,
      principal: minorToKwacha(loan.principal),
      principalMinor: loan.principal.toString(),
      totalDue: minorToKwacha(loan.totalDue),
      totalDueMinor: loan.totalDue.toString(),
      paidAmount: minorToKwacha(loan.paidAmount),
      paidAmountMinor: loan.paidAmount.toString(),
      outstanding: minorToKwacha(outstanding),
      outstandingMinor: outstanding.toString(),
      disbursedAt: loan.disbursedAt,
      createdAt: loan.createdAt,
      schedule: loan.installments.map((i) => ({
        seq: i.seq,
        dueDate: i.dueDate,
        amount: minorToKwacha(i.amount),
        amountMinor: i.amount.toString(),
        paidAmountMinor: i.paidAmount.toString(),
        status: i.status,
        paidAt: i.paidAt,
      })),
    };
  }

  async repaymentsForTenant(tenantId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { tenantId: true },
    });
    if (!loan || loan.tenantId !== tenantId) {
      throw new NotFoundException('Loan not found');
    }

    const rows = await this.prisma.repayment.findMany({
      where: { loanId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        amount: minorToKwacha(r.amount),
        amountMinor: r.amount.toString(),
        method: r.method,
        reference: r.reference,
        recordedBy: r.recordedBy,
        createdAt: r.createdAt,
      })),
    };
  }

  // ─────────────── lender: record a repayment ───────────────

  /**
   * Records money received against a loan. Allocated oldest-installment-first
   * so partial payments are applied where they're owed. Idempotent on the
   * `Idempotency-Key` header — replaying the same request returns the original
   * receipt instead of double-crediting the loan.
   */
  async recordRepayment(
    tenantId: string,
    actorId: string,
    loanId: string,
    dto: RecordRepaymentDto,
    idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim() || randomUUID();

    // Fast path: a replay of an already-processed request.
    const existing = await this.prisma.repayment.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      if (existing.loanId !== loanId) {
        throw new ConflictException('Idempotency key reused for another loan');
      }
      return this.receiptFor(existing.id, loanId, true);
    }

    const amountMinor = kwachaToMinor(dto.amount);
    if (amountMinor <= 0n) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      // Serialize concurrent repayments on the same loan.
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;

      const loan = await tx.loan.findUnique({ where: { id: loanId } });
      if (!loan || loan.tenantId !== tenantId) {
        throw new NotFoundException('Loan not found');
      }

      const outstanding = loan.totalDue - loan.paidAmount;
      if (outstanding <= 0n) {
        throw new BadRequestException('This loan is already fully repaid');
      }
      if (amountMinor > outstanding) {
        throw new BadRequestException(
          `Amount exceeds the outstanding balance of K${minorToKwacha(outstanding)}`,
        );
      }

      const installments = await tx.installment.findMany({
        where: { loanId, status: { not: 'paid' } },
        orderBy: { seq: 'asc' },
      });

      // Pure money math — unit-tested in @kumvwa/core (allocation.spec.ts).
      const allocation = allocateRepayment(
        amountMinor,
        installments.map((i) => ({
          id: i.id,
          seq: i.seq,
          amountMinor: i.amount,
          paidAmountMinor: i.paidAmount,
          status: i.status,
        })),
      );

      for (const change of allocation.changes) {
        await tx.installment.update({
          where: { id: change.id },
          data: {
            paidAmount: change.paidAmountMinor,
            status: change.status,
            // undefined leaves paidAt untouched on a partial payment.
            paidAt: change.settled ? now : undefined,
          },
        });
      }

      const newPaidTotal = loan.paidAmount + amountMinor;
      const cleared = newPaidTotal >= loan.totalDue;

      await tx.loan.update({
        where: { id: loanId },
        data: {
          paidAmount: newPaidTotal,
          status: cleared ? 'cleared' : loan.status,
        },
      });

      const repayment = await tx.repayment.create({
        data: {
          loanId,
          tenantId,
          amount: amountMinor,
          method: dto.method,
          reference: dto.reference?.trim() || null,
          idempotencyKey: key,
          recordedBy: actorId,
        },
      });

      return { repaymentId: repayment.id, clientId: loan.clientId, cleared };
    });

    // Post-tx: notify + audit (never roll back a recorded payment).
    const clientUser = await this.prisma.user.findFirst({
      where: { clientId: result.clientId, role: 'client' },
      select: { id: true },
    });
    if (clientUser) {
      await this.notify.create(
        clientUser.id,
        'payment_received',
        'Payment received',
        `We recorded your K${minorToKwacha(amountMinor)} payment.` +
          (result.cleared ? ' This loan is now fully repaid. 🎉' : ''),
        { loanId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'loan.repayment',
      entity: 'Loan',
      entityId: loanId,
      tenantId,
      diff: {
        amountMinor: amountMinor.toString(),
        method: dto.method,
        cleared: result.cleared,
      },
    });

    return this.receiptFor(result.repaymentId, loanId, false);
  }

  /** Shared receipt shape for both the fresh and replayed paths. */
  private async receiptFor(
    repaymentId: string,
    loanId: string,
    replayed: boolean,
  ) {
    const [repayment, loan, next] = await Promise.all([
      this.prisma.repayment.findUniqueOrThrow({ where: { id: repaymentId } }),
      this.prisma.loan.findUniqueOrThrow({ where: { id: loanId } }),
      this.prisma.installment.findFirst({
        where: { loanId, status: { not: 'paid' } },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const outstanding = loan.totalDue - loan.paidAmount;
    return {
      id: repayment.id,
      replayed,
      amount: minorToKwacha(repayment.amount),
      amountMinor: repayment.amount.toString(),
      method: repayment.method,
      reference: repayment.reference,
      createdAt: repayment.createdAt,
      loan: {
        id: loan.id,
        status: loan.status,
        paidAmountMinor: loan.paidAmount.toString(),
        outstandingMinor: outstanding.toString(),
        outstanding: minorToKwacha(outstanding),
        nextDueDate: next?.dueDate ?? null,
      },
    };
  }

  private toListJson(l: {
    id: string;
    status: string;
    rateBps: number;
    termCount: number;
    principal: bigint;
    totalDue: bigint;
    paidAmount: bigint;
    client: { firstName: string; lastName: string; phone: string };
    installments: { dueDate: Date; amount: bigint }[];
  }) {
    const outstanding = l.totalDue - l.paidAmount;
    const next = l.installments[0];
    return {
      id: l.id,
      clientName: `${l.client.firstName} ${l.client.lastName}`.trim(),
      clientPhone: l.client.phone,
      status: l.status,
      rateBps: l.rateBps,
      termCount: l.termCount,
      principal: minorToKwacha(l.principal),
      principalMinor: l.principal.toString(),
      totalDue: minorToKwacha(l.totalDue),
      totalDueMinor: l.totalDue.toString(),
      paidAmount: minorToKwacha(l.paidAmount),
      paidAmountMinor: l.paidAmount.toString(),
      outstanding: minorToKwacha(outstanding),
      outstandingMinor: outstanding.toString(),
      nextDueDate: next?.dueDate ?? null,
      nextDueAmountMinor: next?.amount.toString() ?? null,
    };
  }
}
