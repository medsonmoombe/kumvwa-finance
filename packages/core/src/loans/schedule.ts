/**
 * Deterministic, integer-only loan schedule.
 * Interest is flat on the principal (simple interest) — the model the
 * mobile mock has always used; the lender sets rateBps per request.
 * An optional one-off origination fee is folded into the total due.
 *
 * Date contract: every date here is a date-only value holding the UTC midnight
 * of a Zambian civil day (see `time/clock`). The term is counted from the day
 * the loan was released, never from a fixed day-of-month.
 */

import { businessDate } from '../time/clock';

export type Frequency = 'monthly' | 'weekly' | 'fortnightly';

/**
 * 'installments' — the classic amortizing schedule (N payments).
 * 'bullet' — ONE virtual installment for the full amount, due at maturity
 * (termCount is months from firstDueDate). Flexible/any-time chunk payments
 * reduce that single installment; the platform's default for this market.
 */
export type Structure = 'installments' | 'bullet';

export interface ScheduleInput {
  principalMinor: bigint;
  rateBps: number;
  termCount: number;
  /**
   * Due date of installment #1 (UTC midnight of a Zambian civil date) — that
   * is, one payment period AFTER the loan was drawn down. Use
   * `firstDueDateFrom()` to derive it so the term can never be swallowed by
   * the anchor.
   */
  firstDueDate: Date;
  /** Installment spacing. Default 'monthly'. */
  frequency?: Frequency;
  /** One-off origination fee folded into the total (NOT interest). */
  feeMinor?: bigint;
  /** Repayment structure. Default 'installments'. */
  structure?: Structure;
}

export interface ScheduleInstallment {
  seq: number;
  dueDate: Date;
  amountMinor: bigint;
}

export interface Schedule {
  totalDueMinor: bigint;
  /** The fee included in totalDueMinor (0 when none). */
  feeMinor: bigint;
  installments: ScheduleInstallment[];
}

/** Rounds half-up, integer-only: (principal * (10000 + rateBps)) / 10000 */
export function totalDueMinor(principalMinor: bigint, rateBps: number): bigint {
  const numerator = principalMinor * BigInt(10000 + rateBps);
  return (numerator + 5000n) / 10000n;
}

/**
 * Period-aware date math: monthly clamps month-ends (Jan 31 + 1mo → Feb 28);
 * weekly/fortnightly are plain day arithmetic (never clamp).
 */
export function addFrequency(
  d: Date,
  periods: number,
  f: Frequency = 'monthly',
): Date {
  if (f === 'monthly') return addMonthsUtc(d, periods);
  const days = periods * (f === 'weekly' ? 7 : 14);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days),
  );
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const { principalMinor, rateBps, termCount, firstDueDate } = input;
  const frequency: Frequency = input.frequency ?? 'monthly';
  const feeMinor = input.feeMinor ?? 0n;
  if (principalMinor <= 0n) throw new Error('principal must be positive');
  if (termCount < 1) throw new Error('termCount must be at least 1');
  if (rateBps < 0) throw new Error('rateBps must not be negative');
  if (feeMinor < 0n) throw new Error('feeMinor must not be negative');

  // Interest stays flat on the principal; the fee is a one-off addition.
  const interestMinor = totalDueMinor(principalMinor, rateBps) - principalMinor;
  const total = principalMinor + interestMinor + feeMinor;

  // Bullet: one installment for the whole obligation at maturity. Everything
  // downstream (allocation, penalties, rollover, PAR) works on top of it —
  // a bullet loan is just N=1 with a term-length maturity.
  if ((input.structure ?? 'installments') === 'bullet') {
    if (!Number.isInteger(termCount) || termCount < 1 || termCount > 36) {
      throw new Error('termCount is months for bullet (1..36)');
    }
    // The single installment IS the last one, so it sits `termCount - 1`
    // periods after installment #1 — which together puts maturity exactly
    // `termCount` periods after drawdown. A 1-month bullet therefore matures
    // one calendar month after disbursement.
    const dueDate = addFrequency(firstDueDate, termCount - 1, frequency);
    return {
      totalDueMinor: total,
      feeMinor,
      installments: [{ seq: 1, dueDate, amountMinor: total }],
    };
  }

  const per = total / BigInt(termCount);

  const installments: ScheduleInstallment[] = [];
  let allocated = 0n;
  for (let i = 0; i < termCount; i++) {
    const isLast = i === termCount - 1;
    // Last installment absorbs rounding so the sum is exactly `total`.
    const amountMinor = isLast ? total - allocated : per;
    allocated += amountMinor;
    installments.push({
      seq: i + 1,
      dueDate: addFrequency(firstDueDate, i, frequency),
      amountMinor,
    });
  }
  return { totalDueMinor: total, feeMinor, installments };
}

/** Month arithmetic that never rolls over (Jan 31 + 1mo → Feb 28). */
export function addMonthsUtc(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();
  const targetMonth = m + months;
  const lastDay = new Date(Date.UTC(y, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, targetMonth, Math.min(d, lastDay)));
}

/**
 * The due date of installment #1 for a loan drawn down on [drawnDownAt].
 *
 * The first payment always falls one period AFTER the money is released — a
 * borrower is never billed on the day they borrow. Combined with
 * `buildSchedule`, that places the final installment exactly `termCount`
 * periods after drawdown, which is the only definition of "term" that agrees
 * with what a borrower is told when they apply.
 *
 * [drawnDownAt] is reduced to its Zambian civil date first, so a loan released
 * at 00:30 Lusaka time (22:30 UTC the day before) still matures on the day the
 * borrower thinks it does.
 */
export function firstDueDateFrom(
  drawnDownAt: Date,
  frequency: Frequency = 'monthly',
): Date {
  return addFrequency(businessDate(drawnDownAt), 1, frequency);
}
