/**
 * The business clock.
 *
 * Every date the platform reasons about — when a loan is due, which day a
 * penalty accrues, what "today" means to a risk score — is a *Zambian civil
 * date*, because that is the calendar the borrower and the lender live in. The
 * servers run in UTC, so a naive `new Date()` would say it is still the 27th
 * while it is already the 28th in Lusaka, and a loan could be marked overdue a
 * day early or late depending on the hour it was drawn.
 *
 * The rule this module enforces, so the rest of the codebase never has to
 * think about offsets:
 *
 *   A date-only business value is stored and compared as the UTC-midnight
 *   Date of that Zambian calendar day.
 *
 * That representation is deliberately identical to a Postgres `DATE` column
 * (which Prisma returns as UTC midnight), so `dueDate` values can be compared
 * to `businessDate()` directly with no conversion at the boundary.
 *
 * Africa/Lusaka is UTC+2 (Central Africa Time) and has observed no DST since
 * 1994, so a fixed offset is exact — no timezone database is needed, and the
 * constant below is auditable. If Zambia ever moves, this is the one place to
 * change.
 */

export const BUSINESS_TIME_ZONE = 'Africa/Lusaka';

/** Minutes to ADD to UTC to get Zambian wall-clock time (CAT = UTC+2). */
export const BUSINESS_UTC_OFFSET_MINUTES = 120;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/**
 * The same instant as [now], but shifted so that the `getUTC*` accessors read
 * Zambian wall-clock. Use for reading calendar components:
 * `businessNow().getUTCFullYear()` is the Zambian year.
 */
export function businessNow(now: Date = new Date()): Date {
  return new Date(
    now.getTime() + BUSINESS_UTC_OFFSET_MINUTES * MS_PER_MINUTE,
  );
}

/**
 * "Today" in Zambia, as a date-only value (UTC midnight of the Zambian civil
 * day). This is the value to compare against `Installment.dueDate` and to feed
 * into any date-range query.
 */
export function businessDate(now: Date = new Date()): Date {
  const z = businessNow(now);
  return new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate()));
}

/** The instant business day [date] begins — i.e. midnight Lusaka time. */
export function startOfBusinessDay(date: Date): Date {
  return new Date(date.getTime() - BUSINESS_UTC_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** The final millisecond of business day [date] (23:59:59.999 Lusaka time). */
export function endOfBusinessDay(date: Date): Date {
  return new Date(
    startOfBusinessDay(date).getTime() + MS_PER_DAY - 1,
  );
}

/**
 * Whole days from [from] to [to], both read as date-only values. Negative when
 * [to] is in the past. Exact, because a business day is always 24h — Zambia
 * has no DST, so a business day is never 23 or 25 hours long.
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Shifts a date-only value back by whole days. Exact in both directions because
 * a business day is always 24h in Zambia (no DST), so no calendar is involved.
 */
export function subtractBusinessDays(date: Date, days: number): Date {
  return new Date(date.getTime() - Math.round(days) * MS_PER_DAY);
}

/**
 * The UTC instant at which the current Zambian month began, i.e. 00:00 Lusaka
 * time on the 1st. Use this to range-filter columns holding real instants
 * (`Repayment.createdAt` and friends are stored naive-UTC).
 */
export function startOfBusinessMonth(now: Date = new Date()): Date {
  const z = businessNow(now);
  return startOfBusinessDay(
    new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), 1)),
  );
}

/** The same, [months] months further back (trailing-N-month reports). */
export function startOfBusinessMonthsAgo(
  months: number,
  now: Date = new Date(),
): Date {
  const z = businessNow(now);
  return startOfBusinessDay(
    new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth() - months, 1)),
  );
}

/** The UTC instant the NEXT Zambian month begins — an exclusive upper bound. */
export function startOfNextBusinessMonth(now: Date = new Date()): Date {
  const z = businessNow(now);
  return startOfBusinessDay(
    new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth() + 1, 1)),
  );
}

/**
 * Date-only bounds `[first, next)` of the current Zambian month, for filtering
 * `DATE` columns such as `Installment.dueDate`.
 */
export function businessMonthBounds(now: Date = new Date()): {
  first: Date;
  next: Date;
} {
  const z = businessNow(now);
  return {
    first: new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), 1)),
    next: new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth() + 1, 1)),
  };
}

/**
 * The last [count] Zambian months as `YYYY-MM` labels, oldest first — the
 * skeleton a trailing-N-month report is filled onto. Empty months are present
 * so the chart has no gaps.
 */
export function businessMonthLabels(
  count: number,
  now: Date = new Date(),
): string[] {
  const z = businessNow(now);
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    labels.push(
      new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth() - i, 1))
        .toISOString()
        .slice(0, 7),
    );
  }
  return labels;
}
