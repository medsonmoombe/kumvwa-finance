/**
 * Repayment performance — the "pays on time" signal a lender uses to decide
 * whether to recommend a borrower.
 *
 * It is deliberately scoped to the ORIGINAL plan (`seq <= termCount`). A
 * rollover appends interest-only "extension fee" rows beyond the agreed term;
 * those are born paid and due in the future, so counting them would flatter a
 * borrower who keeps rolling over instead of repaying.
 *
 * "Settled" means the amount AND any accrued penalty on that installment is
 * covered — the same rule the repayment allocation and the loan-cleared check
 * use, so all three agree on what "paid" means.
 */

import { businessDate, daysBetween } from '../time/clock';

export interface PerformanceInstallment {
  seq: number;
  dueDate: Date;
  amountMinor: bigint;
  paidAmountMinor: bigint;
  penaltyMinor?: bigint;
  paidAt: Date | null;
}

export interface RepaymentPerformance {
  /** Original-plan installments that are fully settled (amount + penalty). */
  settled: number;
  /** Settled on or before their due date. */
  onTime: number;
  /** Settled after their due date. */
  late: number;
  /** Still unpaid and already past due. */
  overdueNow: number;
  /**
   * On-time share of every installment that has been DUE (settled + overdue).
   * 100 when a borrower is fully current, 0 when nothing has been judged yet
   * would be misleading — use `hasHistory` to tell those apart.
   */
  onTimeRate: number;
  /** False when no installment has fallen due yet (rate is not meaningful). */
  hasHistory: boolean;
}

/**
 * [today] is a date-only business date. Defaults to the Zambian today; callers
 * with an as-of date (statements, backfills) can pass their own.
 */
export function repaymentPerformance(
  installments: readonly PerformanceInstallment[],
  originalTermCount: number,
  today: Date = businessDate(),
): RepaymentPerformance {
  let settled = 0;
  let onTime = 0;
  let late = 0;
  let overdueNow = 0;

  for (const i of installments) {
    if (i.seq > originalTermCount) continue; // rollover extension row
    const fullyPaid =
      i.paidAmountMinor >= i.amountMinor + (i.penaltyMinor ?? 0n);
    if (fullyPaid) {
      settled += 1;
      // A missing paidAt on a settled row cannot be judged late; treat it as
      // on time rather than inventing a delinquency.
      const lateDays = i.paidAt
        ? daysBetween(i.dueDate, businessDate(i.paidAt))
        : 0;
      if (lateDays <= 0) onTime += 1;
      else late += 1;
    } else if (daysBetween(i.dueDate, today) > 0) {
      overdueNow += 1;
    }
    // Otherwise: not yet due — deliberately excluded from the rate.
  }

  const judged = onTime + late + overdueNow;
  return {
    settled,
    onTime,
    late,
    overdueNow,
    onTimeRate: judged === 0 ? 0 : round1((onTime * 100) / judged),
    hasHistory: judged > 0,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Roll several per-loan performances into one borrower-level view. Counts add
 * up; the rate is re-derived from the merged counts (never averaged, which
 * would let a 1-installment loan outweigh a 12-installment one).
 */
export function combinePerformance(
  perfs: readonly RepaymentPerformance[],
): RepaymentPerformance {
  let settled = 0;
  let onTime = 0;
  let late = 0;
  let overdueNow = 0;
  for (const p of perfs) {
    settled += p.settled;
    onTime += p.onTime;
    late += p.late;
    overdueNow += p.overdueNow;
  }
  const judged = onTime + late + overdueNow;
  return {
    settled,
    onTime,
    late,
    overdueNow,
    onTimeRate: judged === 0 ? 0 : round1((onTime * 100) / judged),
    hasHistory: judged > 0,
  };
}
