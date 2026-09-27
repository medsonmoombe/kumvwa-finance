import { Injectable } from '@nestjs/common';
import type { LoanStatus } from '@prisma/client';
import {
  businessDate,
  businessMonthBounds,
  businessMonthLabels,
  daysBetween,
  minorToKwacha,
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
  constructor(private readonly prisma: PrismaService) {}

  /** Portfolio snapshot. Sums are computed in SQL, not by looping rows. */
  async summary(tenantId: string) {
    // Two different "this month", because the columns are two different kinds:
    // `dueDate` is a DATE (a Zambian civil date) while `Repayment.createdAt` is
    // a naive-UTC instant. Both must resolve to the same Zambian calendar
    // month, so each gets the bounds helper that matches its column type.
    const { first: dueFrom, next: dueTo } = businessMonthBounds();
    const collectedFrom = startOfBusinessMonth();
    const collectedTo = startOfNextBusinessMonth();

    const [grouped, clientsCount, recent, dueThisMonth, collectedThisMonth] =
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
          include: { client: { select: { firstName: true, lastName: true } } },
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
      clientsCount,
      recentLoans: recent.map((l) => ({
        id: l.id,
        clientName: `${l.client.firstName} ${l.client.lastName}`.trim(),
        principal: minorToKwacha(l.principal),
        principalMinor: l.principal.toString(),
        status: l.status,
        createdAt: l.createdAt,
      })),
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
        status: { in: ['active', 'overdue'] },
      },
      select: {
        totalDue: true,
        paidAmount: true,
        installments: { select: { dueDate: true, amount: true, paidAmount: true } },
      },
    });
    const today = businessDate();

    const buckets = { current: 0n, d1_30: 0n, d31_60: 0n, d61_90: 0n, d90p: 0n };
    let totalOutstanding = 0n;

    for (const l of loans) {
      const outstanding = l.totalDue - l.paidAmount;
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
