/** The API always returns money as integer minor units (ngwee) in a string. */
export function money(minor: string | bigint | number): string {
  const n = Number(minor) / 100;
  return `K ${n.toLocaleString('en-ZM', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * A due date is a bare calendar day (Postgres `DATE`, so it arrives as
 * `2026-10-27T00:00:00.000Z`), and `timeZone: 'UTC'` is what keeps it showing
 * as the 27th. Without the pin, a lender in any negative-offset timezone reads
 * it as the 26th.
 */
export function date(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

/** '2026-03' → 'Mar 26' */
export function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  if (!year || !month) return ym;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return `${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })} ${year.slice(2)}`;
}
