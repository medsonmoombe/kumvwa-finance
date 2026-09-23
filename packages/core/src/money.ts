/**
 * Money rule (platform-wide): all amounts are integer MINOR units (ngwee).
 * Rates are integer basis points (15% = 1500).
 * Kwacha floats exist only at the API edge / UI boundary.
 */

const MINOR_PER_KWACHA = 100n;

/** 800 → 80000n  (rounds to the nearest ngwee, guards float drift) */
export function kwachaToMinor(kwacha: number): bigint {
  if (!Number.isFinite(kwacha)) throw new Error('amount must be a finite number');
  return BigInt(Math.round(kwacha * 100));
}

/** 80000n → 800 */
export function minorToKwacha(minor: bigint): number {
  return Number(minor) / Number(MINOR_PER_KWACHA);
}

/** 80000n → '800.00' (exact decimal string, never float-formatted) */
export function minorToKwachaString(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / MINOR_PER_KWACHA;
  const cents = (abs % MINOR_PER_KWACHA).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${cents}`;
}

/** 92000n → 'K 920.00' for log/UI messages */
export function formatMinor(minor: bigint): string {
  return `K ${minorToKwachaString(minor)}`;
}
