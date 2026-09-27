import { bpsOf } from '../money';
import type { Ngwee } from '../money';

export interface PenaltyTerms {
  /** Daily penalty rate on the unpaid portion, e.g. 50 = 0.5%/day. */
  bpsPerDay: number;
  /** Accumulated penalty cap, in bps of the installment amount, e.g. 2000 = 20%. */
  capBps: number;
}

/** One day's accrual on the unpaid portion. */
export function dailyPenalty(unpaidMinor: Ngwee, bpsPerDay: number): Ngwee {
  if (bpsPerDay <= 0) return 0n;
  return bpsOf(unpaidMinor, bpsPerDay);
}

export function penaltyCap(
  installmentAmountMinor: Ngwee,
  capBps: number,
): Ngwee {
  return bpsOf(installmentAmountMinor, capBps);
}

/**
 * Nightly accrual step: grows the stored penalty by one day, never past the
 * cap. Pure — the overdue job calls this per overdue installment.
 *
 * The cap is relative to the installment's OWN amount (fixed), so a penalty
 * can never outgrow "20% of the installment" however long the account
 * overdues — that is the explainable, regulator-friendly semantic.
 */
export function nextPenalty(p: {
  currentMinor: Ngwee;
  unpaidMinor: Ngwee;
  /** The installment's own amount — the cap's fixed base. */
  installmentAmountMinor: Ngwee;
  terms: PenaltyTerms;
}): Ngwee {
  if (p.terms.bpsPerDay <= 0) return 0n;
  const capMinor = penaltyCap(p.installmentAmountMinor, p.terms.capBps);
  const room = capMinor - p.currentMinor;
  if (room <= 0n) return 0n;
  const daily = dailyPenalty(p.unpaidMinor, p.terms.bpsPerDay);
  return daily > room ? room : daily;
}
