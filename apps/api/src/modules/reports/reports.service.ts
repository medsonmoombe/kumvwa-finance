import { Injectable } from '@nestjs/common';
import type { LoanStatus } from '@prisma/client';
import { StorageService } from '../files/storage.service';
import {
  businessDate,
  businessMonthBounds,
  businessMonthLabels,
  daysBetween,
  minorToKwacha,
  minorToKwachaString,
  nominalInterestMinor,
  startOfBusinessMonth,
  startOfBusinessMonthsAgo,
  startOfNextBusinessMonth,
} from '@kumvwa/core';

import { PrismaService } from '../../infra/prisma.module';

interface MonthRow {
  month: string;
  total: bigint;
}

/** Dashboard/report aggregates for a single tenant (lender). */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Portfolio snapshot. Sums are computed in SQL, not by looping rows. */
  async summary(tenantId: string) {
    // Two different "this month", because the columns are two different kinds:
    // `dueDate` is a DATE (a Zambian civil date) while `Repayment.createdAt` is
    // a naive-UTC instant. Both must resolve to the same Zambian calendar
    // month, so each gets the bounds helper that matches its column type.
    const { first: dueFrom, next: dueTo } = businessMonthBounds();
    const collectedFrom = startOfBusinessMonth();
    const collectedTo = startOfNextBusinessMonth();

    const [grouped, clientsCount, recent, dueThisMonth, collectedThisMonth, interest] =
      await Promise.all([
        this.prisma.loan.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
          _sum: { principal: true, totalDue: true, paidAmount: true },
        }),
        this.prisma.clientLenderLink.count({ where: { tenantId } }),
        this.prisma.loan.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            client: {
              select: {
                firstName: true,
                lastName: true,
                user: {
                  select: {
                    profileFile: { select: { storageKey: true, mime: true } },
                  },
                },
              },
            },
          },
        }),
        // What is actually owed this calendar month, not the whole book.
        this.prisma.installment.aggregate({
          where: {
            status: { not: 'paid' },
            dueDate: { gte: dueFrom, lt: dueTo },
            loan: { tenantId },
          },
          _sum: { amount: true },
        }),
        this.prisma.repayment.aggregate({
          where: { tenantId, createdAt: { gte: collectedFrom, lt: collectedTo } },
          _sum: { amount: true },
        }),
        // Interest, both sides of the same coin:
        //  • contracted — what the issued book is written to earn
        //    (totalDue − principal − fee, including rollover extensions);
        //  • collected — the interest component actually banked, summed from
        //    each repayment's own split (see LoansService.recordRepayment).
        Promise.all([
          this.prisma.loan.aggregate({
            where: { tenantId },
            _sum: { principal: true, totalDue: true, feeMinor: true },
          }),
          this.prisma.repayment.aggregate({
            where: { tenantId },
            _sum: { interestMinor: true },
          }),
        ]),
      ]);

    const bucket = (status: LoanStatus) => {
      const g = grouped.find((x) => x.status === status);
      return {
        count: g?._count._all ?? 0,
        principal: g?._sum.principal ?? 0n,
        totalDue: g?._sum.totalDue ?? 0n,
        paidAmount: g?._sum.paidAmount ?? 0n,
      };
    };

    const active = bucket('active');
    const overdue = bucket('overdue');
    const cleared = bucket('cleared');

    const outstanding =
      active.totalDue - active.paidAmount + (overdue.totalDue - overdue.paidAmount);
    const disbursed =
      active.principal + overdue.principal + cleared.principal;
    const dueMinor = dueThisMonth._sum.amount ?? 0n;
    const collectedMinor = collectedThisMonth._sum.amount ?? 0n;

    const [interestBook, interestCollected] = interest;
    const interestContractedMinor = nominalInterestMinor(
      interestBook._sum.totalDue ?? 0n,
      interestBook._sum.principal ?? 0n,
      interestBook._sum.feeMinor ?? 0n,
    );
    const interestCollectedMinor = interestCollected._sum.interestMinor ?? 0n;

    return {
      counts: {
        active: active.count,
        overdue: overdue.count,
        cleared: cleared.count,
      },
      outstanding: minorToKwacha(outstanding),
      outstandingMinor: outstanding.toString(),
      disbursed: minorToKwacha(disbursed),
      disbursedMinor: disbursed.toString(),
      dueThisMonth: minorToKwacha(dueMinor),
      dueThisMonthMinor: dueMinor.toString(),
      collectedThisMonth: minorToKwacha(collectedMinor),
      collectedThisMonthMinor: collectedMinor.toString(),
      // "Generated from interest" — shown side by side so a lender sees both
      // what the book will earn and what it has actually earned so far.
      interestContracted: minorToKwacha(interestContractedMinor),
      interestContractedMinor: interestContractedMinor.toString(),
      interestCollected: minorToKwacha(interestCollectedMinor),
      interestCollectedMinor: interestCollectedMinor.toString(),
      clientsCount,
      recentLoans: await Promise.all(
        recent.map(async (l) => {
          const pf = l.client.user?.profileFile;
          return {
            id: l.id,
            clientName: `${l.client.firstName} ${l.client.lastName}`.trim(),
            principal: minorToKwacha(l.principal),
            principalMinor: l.principal.toString(),
            status: l.status,
            createdAt: l.createdAt,
            profileImageUrl: pf
              ? await this.storage.presignGet(pf.storageKey, pf.mime)
              : null,
          };
        }),
      ),
    };
  }

  /**
   * Disbursed vs collected per month for the last 6 months. Buckets are
   * produced by Postgres (`date_trunc`) and merged onto a full month
   * skeleton, so months with no activity come back as explicit zeros.
   *
   * The buckets are ZAMBIAN months. `createdAt` is a naive-UTC instant, so the
   * SQL shifts it into Lusaka time before truncating; without that shift a
   * loan disbursed at 23:00 Lusaka time would land in the following month's
   * column.
   */
  async monthly(tenantId: string) {
    const now = new Date();
    const since = startOfBusinessMonthsAgo(5, now);
    const months = businessMonthLabels(6, now);

    const [disbursedRows, collectedRows] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'
                                        AT TIME ZONE 'Africa/Lusaka'), 'YYYY-MM') AS month,
               COALESCE(SUM("principal"), 0)::bigint AS total
        FROM "Loan"
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${since}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'
                                        AT TIME ZONE 'Africa/Lusaka'), 'YYYY-MM') AS month,
               COALESCE(SUM("amount"), 0)::bigint AS total
        FROM "Repayment"
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${since}
        GROUP BY 1
      `,
    ]);

    const disbursed = new Map(disbursedRows.map((r) => [r.month, r.total]));
    const collected = new Map(collectedRows.map((r) => [r.month, r.total]));

    return months.map((month) => ({
      month,
      disbursedMinor: (disbursed.get(month) ?? 0n).toString(),
      collectedMinor: (collected.get(month) ?? 0n).toString(),
    }));
  }

  /** Full loan book as CSV. Capped at 5000 rows; larger exports move to a job. */
  async loansCsv(tenantId: string): Promise<string> {
    const loans = await this.prisma.loan.findMany({
      where: { tenantId },
      include: { client: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
    const kwacha = (minor: bigint) => (Number(minor) / 100).toFixed(2);

    const rows = [
      'loan_id,client,principal_kwacha,total_kwacha,paid_kwacha,outstanding_kwacha,status,created_at',
      ...loans.map((l) =>
        [
          l.id,
          esc(`${l.client.firstName} ${l.client.lastName}`.trim()),
          kwacha(l.principal),
          kwacha(l.totalDue),
          kwacha(l.paidAmount),
          kwacha(l.totalDue - l.paidAmount),
          l.status,
          l.createdAt.toISOString(),
        ].join(','),
      ),
    ];

    return rows.join('\n');
  }

  /** PAR ageing for one lender. */
  async par(tenantId: string) {
    return this.computePar(tenantId);
  }

  /** PAR ageing across every lender (the admin view). */
  async platformPar() {
    return this.computePar(undefined);
  }

  async platformMonthly() {
    const now = new Date();
    const since = startOfBusinessMonthsAgo(5, now);
    const months = businessMonthLabels(6, now);

    const [disbursedRows, collectedRows] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'
                                        AT TIME ZONE 'Africa/Lusaka'), 'YYYY-MM') AS month,
               COALESCE(SUM("principal"), 0)::bigint AS total
        FROM "Loan" WHERE "createdAt" >= ${since} GROUP BY 1
      `,
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt" AT TIME ZONE 'UTC'
                                        AT TIME ZONE 'Africa/Lusaka'), 'YYYY-MM') AS month,
               COALESCE(SUM("amount"), 0)::bigint AS total
        FROM "Repayment" WHERE "createdAt" >= ${since} GROUP BY 1
      `,
    ]);

    const disbursed = new Map(disbursedRows.map((r) => [r.month, r.total]));
    const collected = new Map(collectedRows.map((r) => [r.month, r.total]));
    return months.map((month) => ({
      month,
      disbursedMinor: (disbursed.get(month) ?? 0n).toString(),
      collectedMinor: (collected.get(month) ?? 0n).toString(),
    }));
  }

  /**
   * Platform-wide interest across ALL lenders, plus a per-lender breakdown so
   * an operator can see which books are actually earning. Same two definitions
   * as the lender summary (contracted vs collected), aggregated here rather
   * than summed from the per-tenant calls.
   */
  async platformInterest() {
    const [loanAgg, repayAgg, loanByTenant, repayByTenant, tenants] =
      await Promise.all([
        this.prisma.loan.aggregate({
          _sum: { principal: true, totalDue: true, feeMinor: true },
        }),
        this.prisma.repayment.aggregate({ _sum: { interestMinor: true } }),
        this.prisma.loan.groupBy({
          by: ['tenantId'],
          _sum: { principal: true, totalDue: true, feeMinor: true },
        }),
        this.prisma.repayment.groupBy({
          by: ['tenantId'],
          _sum: { interestMinor: true },
        }),
        this.prisma.tenant.findMany({ select: { id: true, name: true } }),
      ]);

    const contractedMinor = nominalInterestMinor(
      loanAgg._sum.totalDue ?? 0n,
      loanAgg._sum.principal ?? 0n,
      loanAgg._sum.feeMinor ?? 0n,
    );
    const collectedMinor = repayAgg._sum.interestMinor ?? 0n;

    const contractBy = new Map(
      loanByTenant.map((r) => [
        r.tenantId,
        nominalInterestMinor(
          r._sum.totalDue ?? 0n,
          r._sum.principal ?? 0n,
          r._sum.feeMinor ?? 0n,
        ),
      ]),
    );
    const collectedBy = new Map(
      repayByTenant.map((r) => [r.tenantId, r._sum.interestMinor ?? 0n]),
    );

    const byLender = tenants
      .map((t) => {
        const contracted = contractBy.get(t.id) ?? 0n;
        const collected = collectedBy.get(t.id) ?? 0n;
        return {
          tenantId: t.id,
          tenantName: t.name,
          contractedMinor: contracted.toString(),
          contracted: minorToKwachaString(contracted),
          collectedMinor: collected.toString(),
          collected: minorToKwachaString(collected),
        };
      })
      .filter((r) => r.contractedMinor !== '0' || r.collectedMinor !== '0')
      .sort((a, b) => Number(BigInt(b.collectedMinor) - BigInt(a.collectedMinor)));

    return {
      contractedMinor: contractedMinor.toString(),
      contracted: minorToKwachaString(contractedMinor),
      collectedMinor: collectedMinor.toString(),
      collected: minorToKwachaString(collectedMinor),
      lenders: byLender.length,
      byLender,
    };
  }

  /**
   * Portfolio at risk. A loan is aged by its MOST-late unpaid installment and
   * its whole remaining balance follows that bucket, because a lender cannot
   * recover part of a loan that is 60 days late on part of it.
   *
   * PAR-30 deliberately starts at 31 days: 1-30 days late is normal servicing
   * lag, not a loan at risk.
   */
  private async computePar(tenantId: string | undefined) {
    const loans = await this.prisma.loan.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        // `defaulted` is included on purpose: a written-off loan still carries
        // recoverable principal, and excluding it would let total outstanding
        // fall precisely when a portfolio is doing worst.
        status: { in: ['active', 'overdue', 'defaulted'] },
      },
      select: {
        totalDue: true,
        paidAmount: true,
        installments: {
          select: {
            dueDate: true,
            amount: true,
            paidAmount: true,
            penaltyMinor: true,
          },
        },
      },
    });
    const today = businessDate();

    const buckets = { current: 0n, d1_30: 0n, d31_60: 0n, d61_90: 0n, d90p: 0n };
    let totalOutstanding = 0n;

    for (const l of loans) {
      // What the borrower actually owes INCLUDES accrued late penalties.
      // Reporting `totalDue - paidAmount` alone understates every delinquent
      // loan and flatters PAR-30, which is the number lenders use to decide
      // whether to write off — so penalties have to be in the balance.
      const penalty = l.installments.reduce((sum, i) => sum + i.penaltyMinor, 0n);
      const outstanding = l.totalDue - l.paidAmount + penalty;
      if (outstanding <= 0n) continue;
      totalOutstanding += outstanding;

      const daysLate = Math.max(
        0,
        ...l.installments
          .filter((i) => i.paidAmount < i.amount)
          .map((i) => daysBetween(i.dueDate, today)),
      );

      if (daysLate === 0) buckets.current += outstanding;
      else if (daysLate <= 30) buckets.d1_30 += outstanding;
      else if (daysLate <= 60) buckets.d31_60 += outstanding;
      else if (daysLate <= 90) buckets.d61_90 += outstanding;
      else buckets.d90p += outstanding;
    }

    const par30Minor = buckets.d31_60 + buckets.d61_90 + buckets.d90p;

    return {
      buckets: {
        current: buckets.current.toString(),
        d1_30: buckets.d1_30.toString(),
        d31_60: buckets.d31_60.toString(),
        d61_90: buckets.d61_90.toString(),
        d90p: buckets.d90p.toString(),
      },
      totalOutstandingMinor: totalOutstanding.toString(),
      par30Minor: par30Minor.toString(),
      par30Pct:
        totalOutstanding > 0n
          ? Number((par30Minor * 10000n) / totalOutstanding) / 100
          : 0,
    };
  }
}
