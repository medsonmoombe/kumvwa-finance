/**
 * Deterministic, integer-only loan schedule.
 * Interest is flat on the principal (simple interest) — the model the
 * mobile mock has always used; the lender sets rateBps per request.
 */

export interface ScheduleInput {
  principalMinor: bigint;
  rateBps: number;
  termCount: number;
  /** Due date of installment #1 (UTC midnight). */
  firstDueDate: Date;
}

export interface ScheduleInstallment {
  seq: number;
  dueDate: Date;
  amountMinor: bigint;
}

export interface Schedule {
  totalDueMinor: bigint;
  installments: ScheduleInstallment[];
}

/** Rounds half-up, integer-only: (principal * (10000 + rateBps)) / 10000 */
export function totalDueMinor(principalMinor: bigint, rateBps: number): bigint {
  const numerator = principalMinor * BigInt(10000 + rateBps);
  return (numerator + 5000n) / 10000n;
}

export function buildSchedule(input: ScheduleInput): Schedule {
  const { principalMinor, rateBps, termCount, firstDueDate } = input;
  if (principalMinor <= 0n) throw new Error('principal must be positive');
  if (termCount < 1) throw new Error('termCount must be at least 1');
  if (rateBps < 0) throw new Error('rateBps must not be negative');

  const total = totalDueMinor(principalMinor, rateBps);
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
      dueDate: addMonthsUtc(firstDueDate, i),
      amountMinor,
    });
  }
  return { totalDueMinor: total, installments };
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

/** 12th of next month, UTC — the platform-wide due-date convention. */
export function firstDueDateUtc(from: Date = new Date()): Date {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 12));
}
