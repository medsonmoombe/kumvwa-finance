import { PrismaClient } from '@prisma/client';
import {
  businessDate,
  daysBetween,
  nextPenalty,
  subtractBusinessDays,
} from '@kumvwa/core';

import { logger } from '../logger';

/**
 * A loan is written off once money has been outstanding this long. 90 days is
 * deliberately the same window as the policy's `cooldownDaysAfterDefault`:
 * a borrower is considered written off at the same age at which they become
 * eligible to borrow again. Hard blocks are platform-wide, so this threshold is
 * global rather than per-tenant policy.
 */
const DEFAULT_AFTER_DAYS_LATE = 90;

const prisma = new PrismaClient();

/**
 * Overdue sweep: flips past-due installments, accrues daily penalties, and
 * cures loans that have been brought back up to date.
 *
 * The worker ticks far more often than once a day, so every step here has to be
 * safe to run repeatedly and safe to run concurrently with another tick.
 */
export async function processOverdue(): Promise<void> {
  // "Today" is the Zambian civil day, not the UTC one: between 22:00 and 24:00
  // UTC it is already tomorrow in Lusaka, and an installment due on the 27th
  // must not flip to overdue until the 28th actually begins locally.
  const today = businessDate();

  // 1. Past-due pending installments become overdue (idempotent).
  const flipped = await prisma.installment.updateMany({
    where: { status: 'pending', dueDate: { lt: today } },
    data: { status: 'overdue' },
  });

  // 2. Loans carrying an overdue installment are flagged overdue.
  const loansFlipped = await prisma.loan.updateMany({
    where: {
      status: 'active',
      installments: { some: { status: 'overdue' } },
    },
    data: { status: 'overdue' },
  });

  // 3. Penalty accrual — per-product opt-in, capped, once per business day.
  //
  //    Idempotency lives in the database (`Installment.lastPenaltyDate`), not in
  //    this process: an in-memory day counter re-charges the day on every worker
  //    restart, and a restart is not rare. Each row is advanced with a
  //    conditional update so two concurrent ticks cannot both charge it.
  const accrued = await accruePenalties(today);

  // 4. A borrower who clears everything returns to `active`. Without this a
  //    loan stays `overdue` forever after payment, which keeps `blockIfOverdue`
  //    refusing them a new loan and shows a false red balance.
  const cured = await cureSettledLoans();

  // 5. Anything still owed this long after falling due is written off. Runs
  //    AFTER the cure step on purpose: a borrower who paid everything in the
  //    same sweep must never be written off, and the `status: 'overdue'` guard
  //    below cannot match a loan the cure already returned to `active`.
  const defaulted = await defaultLongOverdueLoans(today);

  if (
    flipped.count > 0 ||
    loansFlipped.count > 0 ||
    accrued > 0 ||
    cured > 0 ||
    defaulted > 0
  ) {
    logger.info(
      `overdue: ${flipped.count} installments + ${loansFlipped.count} loans flipped, ` +
        `${accrued} penalties accrued, ${cured} loans cured, ${defaulted} defaulted`,
    );
  }
}

/**
 * Upper bound on catch-up days in one sweep. A worker that has been down for a
 * year must not spin through 365 iterations per row; the penalty cap makes the
 * daily step return 0 long before this in practice, so the bound is a backstop
 * rather than a real limit.
 */
const MAX_CATCHUP_DAYS = 365;

/**
 * Accrues penalties for every overdue installment that is behind on its day
 * anchor. Returns how many rows were actually charged.
 *
 * Paged rather than `take: N` so a large portfolio is never silently truncated
 * — a fixed cap would quietly stop penalising the tail forever. Every row read
 * is stamped (even the ones that cannot be charged), so the result set shrinks
 * monotonically and the page loop always terminates; skipping a row without
 * stamping it would make the same full page come back forever.
 */
async function accruePenalties(today: Date): Promise<number> {
  const PAGE = 200;
  let advanced = 0;

  for (;;) {
    const stale = await prisma.installment.findMany({
      where: {
        status: 'overdue',
        OR: [{ lastPenaltyDate: null }, { lastPenaltyDate: { lt: today } }],
        // Zero-penalty products can never be charged, so never read them.
        loan: { product: { penaltyBpsPerDay: { gt: 0 } } },
      },
      select: {
        id: true,
        amount: true,
        paidAmount: true,
        penaltyMinor: true,
        lastPenaltyDate: true,
        loan: {
          select: {
            product: { select: { penaltyBpsPerDay: true, penaltyCapBps: true } },
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: PAGE,
    });

    if (stale.length === 0) return advanced;

    for (const inst of stale) {
      const product = inst.loan.product;
      const unpaid = inst.amount - inst.paidAmount;

      // Missed days are charged, not just the current one: a worker that was
      // down for three days owes three days of penalty. A NULL anchor means the
      // row flipped overdue today and has never been charged — the anchor
      // migration backfills pre-existing rows so this stays unambiguous.
      const missed = inst.lastPenaltyDate
        ? daysBetween(inst.lastPenaltyDate, today)
        : 1;

      let charge = 0n;
      if (product && product.penaltyBpsPerDay > 0 && unpaid > 0n) {
        let running = inst.penaltyMinor;
        const days = Math.max(1, Math.min(missed, MAX_CATCHUP_DAYS));
        for (let day = 0; day < days; day++) {
          const step = nextPenalty({
            currentMinor: running,
            unpaidMinor: unpaid,
            installmentAmountMinor: inst.amount,
            terms: {
              bpsPerDay: product.penaltyBpsPerDay,
              capBps: product.penaltyCapBps,
            },
          });
          // Zero means the cap is reached; further days cannot change anything.
          if (step <= 0n) break;
          running += step;
          charge += step;
        }
      }

      // `increment` plus a `lastPenaltyDate` guard makes this a single atomic
      // statement: a losing tick updates nothing because the guard no longer
      // matches. Rows that owe nothing are stamped anyway so they stop being
      // re-read.
      const res = await prisma.installment.updateMany({
        where: {
          id: inst.id,
          OR: [{ lastPenaltyDate: null }, { lastPenaltyDate: { lt: today } }],
        },
        data:
          charge > 0n
            ? { penaltyMinor: { increment: charge }, lastPenaltyDate: today }
            : { lastPenaltyDate: today },
      });
      if (res.count > 0 && charge > 0n) advanced += res.count;
    }

    if (stale.length < PAGE) return advanced;
  }
}

/**
 * Returns an `overdue` loan to `active` once nothing is still unpaid.
 *
 * An installment is either `paid` or awaiting money, so "nothing in
 * `pending`/`overdue`" is exactly "the borrower has settled". Previously
 * nothing performed this transition, so a loan that had been paid off stayed
 * `overdue` for ever: `blockIfOverdue` kept refusing the borrower a new loan and
 * their balance stayed red.
 */
async function cureSettledLoans(): Promise<number> {
  const res = await prisma.loan.updateMany({
    where: {
      status: 'overdue',
      installments: { none: { status: { in: ['pending', 'overdue'] } } },
    },
    data: { status: 'active' },
  });
  return res.count;
}

/**
 * Writes off loans that have been delinquent far longer than servicing can
 * reasonably wait.
 *
 * `defaulted` previously had no writer at all, so `defaultedCount` in the risk
 * profile was always 0 and the 90-day post-default cooldown never applied to
 * anybody — the status existed in the enum and in reports, but was unreachable.
 */
async function defaultLongOverdueLoans(today: Date): Promise<number> {
  const cutoff = subtractBusinessDays(today, DEFAULT_AFTER_DAYS_LATE);

  // Prisma cannot compare two columns of the same row, so candidates are
  // collected by due date and the still-unpaid ones are filtered here.
  const aged = await prisma.installment.findMany({
    where: { status: 'overdue', dueDate: { lte: cutoff } },
    select: { loanId: true, amount: true, paidAmount: true },
  });

  const loanIds = [
    ...new Set(
      aged
        .filter((i) => i.paidAmount < i.amount)
        .map((i) => i.loanId),
    ),
  ];
  if (loanIds.length === 0) return 0;

  const res = await prisma.loan.updateMany({
    where: { id: { in: loanIds }, status: 'overdue' },
    data: { status: 'defaulted' },
  });
  return res.count;
}