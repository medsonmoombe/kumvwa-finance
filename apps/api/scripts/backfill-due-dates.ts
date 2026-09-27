/**
 * Repairs loan schedules that were anchored to a fixed day of the month
 * instead of the day the money was released.
 *
 * A term of N months must mature N calendar months after disbursement. The old
 * logic put the first due date on the 12th of the following month, so a
 * 1-month loan drawn on the 27th matured on the 12th — 15 days instead of a
 * month, and for some loans a date that fell *before* the money was released.
 *
 * This rewrites only the due DATE of existing installments. Amounts, penalties
 * and payments are left alone, so the affected rows are printed for review and
 * nothing is written unless you pass --apply.
 *
 *   pnpm exec tsx scripts/backfill-due-dates.ts            # dry run (default)
 *   pnpm exec tsx scripts/backfill-due-dates.ts --apply    # write, in a txn
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import {
  businessDate,
  buildSchedule,
  daysBetween,
  firstDueDateFrom,
  startOfBusinessDay,
} from '@kumvwa/core';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

type Row = {
  loanId: string;
  loanRef: string;
  clientName: string;
  structure: string;
  frequency: string;
  termCount: number;
  disbursedAt: Date;
  firstDue: Date;
  expectedFirstDue: Date;
  shifts: number;
  paidInstallments: number;
  totalPenaltyMinor: bigint;
  anyEarlier: boolean;
  sample: string;
};

async function main() {
  const loans = await prisma.loan.findMany({
    where: { disbursedAt: { not: null } },
    include: {
      client: { select: { firstName: true, lastName: true } },
      installments: { orderBy: { seq: 'asc' } },
    },
    orderBy: { loanRef: 'asc' },
  });

  const rows: Row[] = [];

  for (const loan of loans) {
    if (loan.installments.length === 0) continue;

    // Compute the target exactly the way approval does, so what this prints is
    // what would be written. Note that a *bullet* loan's only installment is
    // the MATURITY (drawdown + termCount periods), not the first period.
    const rebuilt = buildSchedule({
      principalMinor: loan.principal,
      rateBps: loan.rateBps,
      termCount: loan.termCount,
      firstDueDate: firstDueDateFrom(loan.disbursedAt, loan.frequency),
      structure: loan.repaymentStructure,
    });

    let shifts = 0;
    let mismatched = 0;
    let anyEarlier = false;
    for (const inst of loan.installments) {
      const target = rebuilt.installments[inst.seq - 1];
      if (!target) continue;
      const actual = businessDate(inst.dueDate);
      const wanted = businessDate(target.dueDate);
      if (actual.getTime() === wanted.getTime()) continue;
      mismatched++;
      const delta = daysBetween(actual, wanted);
      shifts = Math.max(shifts, delta);
      if (delta < 0) anyEarlier = true;
    }
    if (mismatched === 0) continue;

    const paid = loan.installments.filter((i) => i.status === 'paid').length;
    const penalty = loan.installments.reduce((a, i) => a + i.penaltyMinor, 0n);

    rows.push({
      loanId: loan.id,
      loanRef: loan.loanRef,
      clientName: [loan.client.firstName, loan.client.lastName]
        .filter(Boolean)
        .join(' '),
      structure: loan.repaymentStructure,
      frequency: loan.frequency,
      termCount: loan.termCount,
      disbursedAt: loan.disbursedAt!,
      firstDue: businessDate(loan.installments[0]!.dueDate),
      expectedFirstDue: businessDate(rebuilt.installments[0]!.dueDate),
      shifts,
      paidInstallments: paid,
      totalPenaltyMinor: penalty,
      anyEarlier,
      sample: `${paid} paid`,
    });
  }

  const heading =
    'loanRef     client                  struct  freq        term  drawn        due(now)  ->  due(fixed)  shift  notes';
  console.log(apply ? 'APPLYING' : 'DRY RUN — no writes');
  console.log(heading);
  console.log('-'.repeat(heading.length));

  for (const r of rows) {
    const warning =
      r.paidInstallments > 0 || r.totalPenaltyMinor > 0n
        ? `${r.sample}${r.totalPenaltyMinor > 0n ? ` +K${r.totalPenaltyMinor / 100n} penalty` : ''}`
        : '-';
    console.log(
      [
        r.loanRef.padEnd(11),
        r.clientName.slice(0, 22).padEnd(22),
        r.structure.padEnd(7),
        r.frequency.padEnd(11),
        String(r.termCount).padEnd(5),
        isoDate(r.disbursedAt).padEnd(12),
        isoDate(r.firstDue).padEnd(11),
        `-> ${isoDate(r.expectedFirstDue)}`.padEnd(13),
        `${r.shifts > 0 ? '+' : ''}${r.shifts}d`.padEnd(6),
        warning,
      ].join(' '),
    );
  }

  const backwards = rows.filter((r) => r.anyEarlier).length;
  const withPayments = rows.filter(
    (r) => r.paidInstallments > 0 || r.totalPenaltyMinor > 0n,
  ).length;
  console.log('-'.repeat(heading.length));
  console.log(
    `${rows.length} loan(s) would move. ${backwards} move at least one ` +
      `installment EARLIER, which means a borrower gains time.`,
  );
  console.log(
    `${withPayments} of them have a payment or a penalty recorded — check ` +
      `those by hand before applying.`,
  );
  const today = businessDate(new Date());
  console.log(
    `No due date will be before its own drawdown: ${
      rows.every((r) => r.expectedFirstDue.getTime() >= startOfBusinessDay(r.disbursedAt).getTime())
        ? 'yes'
        : 'NO — investigate'
    } (Zambia today ${isoDate(today)}).`,
  );

  if (!apply || rows.length === 0) {
    if (!apply) console.log('\nRe-run with --apply to write these changes.');
    return;
  }

  // One transaction: either every loan moves or none does.
  await prisma.$transaction(
    rows.map((r) =>
      prisma.$transaction(async (tx) => {
        const loan = await tx.loan.findUniqueOrThrow({
          where: { id: r.loanId },
          include: { installments: { orderBy: { seq: 'asc' } } },
        });
        const rebuilt = buildSchedule({
          principalMinor: loan.principal,
          rateBps: loan.rateBps,
          termCount: loan.termCount,
          firstDueDate: firstDueDateFrom(loan.disbursedAt, loan.frequency),
          structure: loan.repaymentStructure,
        });
        for (const inst of loan.installments) {
          const target = rebuilt.installments[inst.seq - 1]?.dueDate;
          if (!target) continue;
          const current = businessDate(inst.dueDate);
          if (current.getTime() === businessDate(target).getTime()) continue;
          await tx.installment.update({
            where: { id: inst.id },
            data: { dueDate: businessDate(target) },
          });
        }
      }),
    ),
  );

  console.log(`\nApplied: ${rows.length} loan(s) rescheduled.`);
  console.log(
    'Now re-run the risk snapshot for those loans so on-time history matches ' +
      'the corrected dates.',
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
