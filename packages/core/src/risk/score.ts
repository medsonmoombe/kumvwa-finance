/**
 * Internal credit scoring — the platform's own signal, computed from
 * repayment behaviour (no bureau required). Deterministic and pure so both
 * the API and B5's worker jobs share one implementation.
 */

export type RiskBand = 'low' | 'medium' | 'high';

export interface RepaymentHistory {
  loansTotal: number;
  loansCleared: number;
  /** Installments settled on or before their due date. */
  installmentsPaidOnTime: number;
  /** Installments settled after their due date, or still overdue. */
  installmentsLate: number;
  /** Worst number of days an installment ran past due (0 when none). */
  daysOverdueWorst: number;
}

export const SCORE_MIN = 300;
export const SCORE_MAX = 850;
const NO_HISTORY_BASE = 600;
const ON_TIME_BONUS_PER_INSTALLMENT = 15;
const ON_TIME_BONUS_CAP = 60;
const LATE_PENALTY_PER_INSTALLMENT = 40;
const LATE_PENALTY_CAP = 200;
const ALL_CLEARED_BONUS = 20;

/**
 * Returns null when the client has no borrowing history at all — callers
 * must then use the configurable "no history" limit rather than a score.
 */
export function internalScore(h: RepaymentHistory): number | null {
  if (h.loansTotal === 0) return null;

  let score = NO_HISTORY_BASE;
  score += Math.min(
    h.installmentsPaidOnTime * ON_TIME_BONUS_PER_INSTALLMENT,
    ON_TIME_BONUS_CAP,
  );
  score -= Math.min(
    h.installmentsLate * LATE_PENALTY_PER_INSTALLMENT,
    LATE_PENALTY_CAP,
  );
  score -= Math.min(Math.max(h.daysOverdueWorst, 0), 120);
  if (h.loansCleared > 0 && h.loansCleared === h.loansTotal) {
    score += ALL_CLEARED_BONUS;
  }
  return clamp(score, SCORE_MIN, SCORE_MAX);
}

export function bandFromScore(score: number): RiskBand {
  if (score >= 700) return 'low';
  if (score >= 600) return 'medium';
  return 'high';
}

/**
 * Kwacha limit ladder. The API never hardcodes this — it reads the table
 * here and the no-history fallback from config.
 */
export function creditLimitKwacha(
  score: number | null,
  noHistoryLimitKwacha: number,
): number {
  if (score === null) return noHistoryLimitKwacha;
  if (score >= 750) return 15000;
  if (score >= 700) return 10000;
  if (score >= 600) return 5000;
  if (score >= 550) return 3000;
  return 1500;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
