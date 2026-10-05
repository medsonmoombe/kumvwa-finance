import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LoanStatus } from '@prisma/client';
import {
  allocateRepayment,
  interestPaidOnInstallment,
  kwachaToMinor,
  minorToKwacha,
  nominalInterestMinor,
} from '@kumvwa/core';
import { randomUUID } from 'node:crypto';
import { Inject } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { RecordRepaymentDto, RolloverDto } from './dto/loans.dto';

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
    @Inject(ENV) private readonly env: Env,
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
          const outstanding = l.installments.reduce((sum, installment) => {
            const owed = installment.amount + installment.penaltyMinor - installment.paidAmount;
            return sum + (owed > 0n ? owed : 0n);
          }, 0n);
          const next = l.installments.find(
            (i) => i.status === 'overdue' || i.status === 'pending',
          );
          const overdueCount = l.installments.filter(
            (i) => i.status === 'overdue',
          ).length;
          return {
            id: l.id,
            loanRef: l.loanRef,
            repaymentStructure: l.repaymentStructure,
            lenderId: l.tenant.id,
            tenantId: l.tenantId,
            lenderName: l.tenant.name,
            principal: Number(l.principal) / 100,
            principalMinor: l.principal.toString(),
            rateBps: l.rateBps,
            termCount: l.termCount,
            frequency: l.frequency,
            feeMinor: l.feeMinor.toString(),
            disbursementMinor: l.disbursementMinor.toString(),
            rolloverCount: l.rolloverCount,
            totalDue: Number(l.totalDue) / 100,
            totalDueMinor: l.totalDue.toString(),
            paid: Number(l.paidAmount) / 100,
            paidMinor: l.paidAmount.toString(),
            // Immutable terms (frozen at issuance) — the borrower can always
            // see exactly what they agreed to, and verify it never changed.
            terms: l.termsSnapshot ?? null,
            termsHash: l.termsHash,
            interestContractedMinor: nominalInterestMinor(
              l.totalDue,
              l.principal,
              l.feeMinor,
            ).toString(),
            interestPaidMinor: l.installments
              .reduce(
                (sum, i) =>
                  sum + interestPaidOnInstallment(i.interestMinor, i.paidAmount, i.amount),
                0n,
              )
              .toString(),
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
              penaltyMinor: i.penaltyMinor.toString(),
              status: i.status,
              paidAt: i.paidAt,
              // Rollover-appended rows are EXTENSION FEES, not installments
              // (the plan has exactly termCount rows) — the client app renders
              // them in their own section.
              rolloverFee: i.seq > l.termCount,
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
        installments: { orderBy: { dueDate: 'asc' } },
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

    const outstanding = loan.installments.reduce((sum, installment) => {
      const owed = installment.amount + installment.penaltyMinor - installment.paidAmount;
      return sum + (owed > 0n ? owed : 0n);
    }, 0n);
    const interestPaidMinor = loan.installments.reduce(
      (sum, i) => sum + interestPaidOnInstallment(i.interestMinor, i.paidAmount, i.amount),
      0n,
    );
    return {
      id: loan.id,
      loanRef: loan.loanRef,
      repaymentStructure: loan.repaymentStructure,
      clientId: loan.clientId,
      // ── Immutable terms (frozen at issuance) + interest split ──
      terms: loan.termsSnapshot ?? null,
      termsHash: loan.termsHash,
      interestContractedMinor: nominalInterestMinor(
        loan.totalDue,
        loan.principal,
        loan.feeMinor,
      ).toString(),
      interestPaidMinor: interestPaidMinor.toString(),
      clientName: `${loan.client.firstName} ${loan.client.lastName}`.trim(),
      clientPhone: loan.client.phone,
      productName: loan.product?.name ?? null,
      status: loan.status,
      rateBps: loan.rateBps,
      termCount: loan.termCount,
      frequency: loan.frequency,
      feeMinor: loan.feeMinor.toString(),
      disbursementMinor: loan.disbursementMinor.toString(),
      rolloverCount: loan.rolloverCount,
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
        penaltyMinor: i.penaltyMinor.toString(),
        interestMinor: i.interestMinor.toString(),
        status: i.status,
        paidAt: i.paidAt,
        // Beyond the original term => appended by a rollover: an extension
        // fee, not part of the agreed repayment plan.
        rolloverFee: i.seq > loan.termCount,
      })),
    };
  }

  async repaymentsForTenant(
    scope: { tenantId?: string; clientId?: string },
    loanId: string,
  ) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      select: { tenantId: true, clientId: true },
    });
    // Deny-list scope (same rule as record/rollover): a mismatch — or an
    // empty scope — 404s, never 403s, so loan ids can't be probed.
    if (
      !loan ||
      (!scope.tenantId && !scope.clientId) ||
      (scope.tenantId !== undefined && loan.tenantId !== scope.tenantId) ||
      (scope.clientId !== undefined && loan.clientId !== scope.clientId)
    ) {
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
        kind: r.kind,
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
    scope: { tenantId?: string; clientId?: string },
    actorId: string,
    loanId: string,
    dto: RecordRepaymentDto,
    idempotencyKey?: string,
    // Set when the money arrived through the payments engine, so the repayment
    // row links back to the intent that moved it.
    opts?: { paymentIntentId?: string },
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

    const scaled = dto.amount * 100;
    if (!Number.isSafeInteger(Math.round(scaled)) || Math.abs(scaled - Math.round(scaled)) > 1e-7) {
      throw new BadRequestException('Amount must have no more than two decimal places');
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
      // Clients may only touch their OWN loan; lenders only their book's.
      // Deny-list: a mismatch 404s (never 403) so ids can't be probed.
      if (
        !loan ||
        (!scope.tenantId && !scope.clientId) ||
        (scope.tenantId !== undefined && loan.tenantId !== scope.tenantId) ||
        (scope.clientId !== undefined && loan.clientId !== scope.clientId)
      ) {
        throw new NotFoundException('Loan not found');
      }

      const installments = await tx.installment.findMany({
        where: { loanId, status: { not: 'paid' } },
        orderBy: { seq: 'asc' },
      });

      // The true obligation is per-installment: amount + accrued penalty minus
      // whatever was already credited. `totalDue` is nominal only — it never
      // includes penalties — so a nominal pay-off must not mark a loan repaid
      // while an overdue installment still owes penalty money.
      const outstanding = installments.reduce((sum, i) => {
        const owed = i.amount + (i.penaltyMinor ?? 0n) - i.paidAmount;
        return owed > 0n ? sum + owed : sum;
      }, 0n);
      if (outstanding <= 0n) {
        throw new BadRequestException('This loan is already fully repaid');
      }
      if (amountMinor > outstanding) {
        throw new BadRequestException(
          `Amount exceeds the outstanding balance of K${minorToKwacha(outstanding)}`,
        );
      }

      // Pure money math — unit-tested in @kumvwa/core (allocation.spec.ts).
      // Penalties ride with their installment: the shortfall includes them,
      // so a payment settles amount+penalty before moving on.
      const allocation = allocateRepayment(
        amountMinor,
        installments.map((i) => ({
          id: i.id,
          seq: i.seq,
          amountMinor: i.amount,
          paidAmountMinor: i.paidAmount,
          status: i.status,
          penaltyMinor: i.penaltyMinor,
        })),
      );

      // Interest booked by THIS payment: the change in each touched
      // installment's pro-rata interest-paid, derived from its own
      // `interestMinor`. Penalties are excluded (they are not interest), and
      // flooring keeps the running total at or below interest actually charged.
      let interestBooked = 0n;
      for (const change of allocation.changes) {
        const before = installments.find((i) => i.id === change.id);
        if (before) {
          interestBooked +=
            interestPaidOnInstallment(
              before.interestMinor,
              change.paidAmountMinor,
              before.amount,
            ) -
            interestPaidOnInstallment(
              before.interestMinor,
              before.paidAmount,
              before.amount,
            );
        }
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

      // A loan is paid off only when EVERY installment — amount PLUS its
      // penalty — is covered. Nominal `totalDue` says nothing about penalties
      // riding on overdue installments, so it must not decide `cleared`.
      const credited = new Map(allocation.changes.map((c) => [c.id, c]));
      const cleared = installments.every((i) => {
        const change = credited.get(i.id);
        const paid = change ? change.paidAmountMinor : i.paidAmount;
        return paid >= i.amount + (i.penaltyMinor ?? 0n);
      });

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
          tenantId: loan.tenantId,
          amount: amountMinor,
          interestMinor: interestBooked < 0n ? 0n : interestBooked,
          kind: 'repayment',
          method: dto.method,
          reference: dto.reference?.trim() || null,
          idempotencyKey: key,
          paymentIntentId: opts?.paymentIntentId ?? null,
          recordedBy: actorId,
        },
      });

      return {
        repaymentId: repayment.id,
        clientId: loan.clientId,
        tenantId: loan.tenantId,
        cleared,
      };
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
      description: `Repayment of K${minorToKwacha(amountMinor)} recorded via ${dto.method}${result.cleared ? ' — loan fully cleared' : ''}`,
      entity: 'Loan',
      entityId: loanId,
      tenantId: result.tenantId,
      diff: {
        amountMinor: amountMinor.toString(),
        method: dto.method,
        cleared: result.cleared,
      },
    });

    return this.receiptFor(result.repaymentId, loanId, false);
  }

  /**
   * "Pay remaining interest & extend due dates by one month."
   *
   * Rules enforced:
   *  - Max 1 extension per loan lifetime (rolloverCount >= ROLLOVER_MAX → reject)
   *  - Loan must be active or overdue (not cleared/defaulted)
   *  - Extension fee = sum of remaining interest on unpaid installments only
   *  - Total cost cap: totalDue + fee must not exceed 2× principal
   *  - No new installment appended — fee recorded in repayment history only
   *  - Idempotent on Idempotency-Key header
   */
  async rollover(
    actorId: string,
    loanId: string,
    scope: { tenantId?: string; clientId?: string },
    dto: RolloverDto,
    idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim() || randomUUID();

    const existing = await this.prisma.repayment.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) {
      if (existing.loanId !== loanId) {
        throw new ConflictException('Idempotency key reused for another loan');
      }
      return this.rolloverReceipt(loanId, true);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Loan" WHERE id = ${loanId} FOR UPDATE`;

      const loan = await tx.loan.findUnique({
        where: { id: loanId },
        include: { installments: { orderBy: { seq: 'asc' } } },
      });
      if (
        !loan ||
        (scope.tenantId != null && loan.tenantId !== scope.tenantId) ||
        (scope.clientId != null && loan.clientId !== scope.clientId)
      ) {
        throw new NotFoundException('Loan not found');
      }

      // ── Validation ──────────────────────────────────────────────────────
      if (loan.status === 'cleared') {
        throw new BadRequestException('This loan is already fully repaid — no extension needed.');
      }
      if (loan.status === 'defaulted') {
        throw new BadRequestException('Defaulted loans cannot be extended.');
      }
      if (loan.rolloverCount >= this.env.ROLLOVER_MAX) {
        throw new BadRequestException(
          'This loan has already been extended once. No further extensions are allowed.',
        );
      }

      const unpaidInstallments = loan.installments.filter(
        (i) => i.paidAmount < i.amount,
      );
      if (unpaidInstallments.length === 0) {
        throw new BadRequestException('All installments are paid — no extension needed.');
      }

      // ── Extension fee = remaining interest on unpaid installments ────────
      // For each unpaid installment: remaining interest = interestMinor - already collected pro-rata.
      // Example: K200 loan, 15% flat, 2 months. Client paid K50 on installment 1 (K115, interestMinor=K15).
      //   Interest already collected on inst 1 = floor(15 * 50 / 115) = K6
      //   Remaining on inst 1 = K15 - K6 = K9
      //   Inst 2 unpaid, interestMinor = K15, remaining = K15
      //   Extension fee = K9 + K15 = K24
      let extensionFeeMinor = 0n;
      for (const i of unpaidInstallments) {
        if (i.interestMinor <= 0n) continue;
        const interestAlreadyPaid =
          i.paidAmount > 0n && i.amount > 0n
            ? (i.interestMinor * i.paidAmount) / i.amount
            : 0n;
        const remaining = i.interestMinor - interestAlreadyPaid;
        if (remaining > 0n) extensionFeeMinor += remaining;
      }

      if (extensionFeeMinor <= 0n) {
        throw new BadRequestException(
          'No interest remains on this loan — extension is not applicable.',
        );
      }

      // ── Total-cost cap: principal + all interest must not exceed 2× principal ──
      const newTotalDue = loan.totalDue + extensionFeeMinor;
      const cap = loan.principal * 2n;
      if (newTotalDue > cap) {
        throw new BadRequestException(
          `Extension would cause total repayable (K${minorToKwacha(newTotalDue)}) to exceed 2× the principal (K${minorToKwacha(cap)}). Extension not allowed.`,
        );
      }

      // ── Shift every unpaid due date +1 month ────────────────────────────
      for (const i of unpaidInstallments) {
        const newDueDate = new Date(
          Date.UTC(
            i.dueDate.getUTCFullYear(),
            i.dueDate.getUTCMonth() + 1,
            i.dueDate.getUTCDate(),
          ),
        );
        await tx.installment.update({
          where: { id: i.id },
          data: { dueDate: newDueDate },
        });
      }

      // ── For bullet loans: grow the single installment by the fee ─────────
      // This keeps Σ installment.amount === totalDue after the update.
      if (loan.repaymentStructure === 'bullet') {
        const inst = loan.installments[0];
        if (inst) {
          await tx.installment.update({
            where: { id: inst.id },
            data: {
              amount: inst.amount + extensionFeeMinor,
              paidAmount: inst.paidAmount + extensionFeeMinor,
              interestMinor: { increment: extensionFeeMinor },
            },
          });
        }
      }

      // ── Update loan totals ───────────────────────────────────────────────
      const newPaidTotal = loan.paidAmount + extensionFeeMinor;
      await tx.loan.update({
        where: { id: loanId },
        data: {
          totalDue: newTotalDue,
          rolloverCount: { increment: 1 },
          paidAmount: newPaidTotal,
          // Status stays active/overdue — the extension doesn't clear the loan.
        },
      });

      // ── Record extension fee as repayment (history only, no installment) ─
      const repayment = await tx.repayment.create({
        data: {
          loanId,
          tenantId: loan.tenantId,
          amount: extensionFeeMinor,
          interestMinor: extensionFeeMinor, // extension fee is pure interest
          kind: 'rollover_interest',
          method: dto.method ?? 'mobile_money',
          reference: dto.reference?.trim() || null,
          idempotencyKey: key,
          recordedBy: actorId,
        },
      });

      return {
        repaymentId: repayment.id,
        clientId: loan.clientId,
        tenantId: loan.tenantId,
        extensionFeeMinor,
      };
    });

    const clientUser = await this.prisma.user.findFirst({
      where: { clientId: result.clientId, role: 'client' },
      select: { id: true },
    });
    if (clientUser) {
      await this.notify.create(
        clientUser.id,
        'payment_received',
        'Loan extended',
        `Your extension fee of K${minorToKwacha(result.extensionFeeMinor)} has been recorded. ` +
          'Your due dates have been moved one month forward.',
        { loanId },
      );
    }

    await this.audit.record({
      actorId,
      action: 'loan.rollover',
      description: `Loan extended — extension fee of K${minorToKwacha(result.extensionFeeMinor)} collected, all unpaid due dates shifted +1 month`,
      entity: 'Loan',
      entityId: loanId,
      tenantId: result.tenantId,
      diff: { extensionFeeMinor: result.extensionFeeMinor.toString() },
    });

    return this.rolloverReceipt(loanId, false);
  }

  /** Shared receipt shape for both the fresh and replayed rollover paths. */
  private async rolloverReceipt(loanId: string, replayed: boolean) {
    const loan = await this.prisma.loan.findUniqueOrThrow({
      where: { id: loanId },
      include: { installments: { orderBy: { seq: 'asc' } } },
    });
    const outstanding = loan.installments.reduce((sum, installment) => {
      const owed = installment.amount + installment.penaltyMinor - installment.paidAmount;
      return sum + (owed > 0n ? owed : 0n);
    }, 0n);
    const next = loan.installments.find((i) => i.status !== 'paid');
    return {
      replayed,
      rolloverCount: loan.rolloverCount,
      newTotalDueMinor: loan.totalDue.toString(),
      outstandingMinor: outstanding.toString(),
      nextDueDate: next?.dueDate ?? null,
    };
  }

  /** Shared receipt shape for both the fresh and replayed paths. */
  private async receiptFor(
    repaymentId: string,
    loanId: string,
    replayed: boolean,
  ) {
    const [repayment, loan, installments] = await Promise.all([
      this.prisma.repayment.findUniqueOrThrow({ where: { id: repaymentId } }),
      this.prisma.loan.findUniqueOrThrow({ where: { id: loanId } }),
      this.prisma.installment.findMany({ where: { loanId }, orderBy: { dueDate: 'asc' } }),
    ]);

    const outstanding = installments.reduce((sum, installment) => {
      const owed = installment.amount + installment.penaltyMinor - installment.paidAmount;
      return sum + (owed > 0n ? owed : 0n);
    }, 0n);
    const next = installments.find((installment) => installment.status !== 'paid');
    return {
      id: repayment.id,
      replayed,
      amount: minorToKwacha(repayment.amount),
      amountMinor: repayment.amount.toString(),
      kind: repayment.kind,
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
    loanRef: string;
    repaymentStructure: string;
    status: string;
    rateBps: number;
    termCount: number;
    principal: bigint;
    totalDue: bigint;
    paidAmount: bigint;
    client: { firstName: string; lastName: string; phone: string };
    installments: { dueDate: Date; amount: bigint; paidAmount: bigint; penaltyMinor: bigint; status: string }[];
  }) {
    const outstanding = l.installments.reduce((sum, installment) => {
      const owed = installment.amount + installment.penaltyMinor - installment.paidAmount;
      return sum + (owed > 0n ? owed : 0n);
    }, 0n);
    const next = l.installments.find((installment) => installment.status !== 'paid');
    return {
      id: l.id,
      loanRef: l.loanRef,
      repaymentStructure: l.repaymentStructure,
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
