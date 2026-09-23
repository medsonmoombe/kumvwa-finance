import { Injectable } from '@nestjs/common';
import type { LoanStatus } from '@prisma/client';
import { minorToKwacha } from '@kumvwa/core';

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
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

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
            dueDate: { gte: monthStart, lt: monthEnd },
            loan: { tenantId },
          },
          _sum: { amount: true },
        }),
        this.prisma.repayment.aggregate({
          where: { tenantId, createdAt: { gte: monthStart, lt: monthEnd } },
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
   */
  async monthly(tenantId: string) {
    const now = new Date();
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
    );

    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      months.push(d.toISOString().slice(0, 7));
    }

    const [disbursedRows, collectedRows] = await Promise.all([
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
               COALESCE(SUM("principal"), 0)::bigint AS total
        FROM "Loan"
        WHERE "tenantId" = ${tenantId} AND "createdAt" >= ${since}
        GROUP BY 1
      `,
      this.prisma.$queryRaw<MonthRow[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
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
}
