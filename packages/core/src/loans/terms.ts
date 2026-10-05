/**
 * Immutable loan terms — the conditions a loan was ISSUED at.
 *
 * Once a loan is disbursed, the terms it was written on (principal, rate,
 * term, frequency, fee, structure, and the exact repayment schedule) are frozen
 * as a snapshot and hashed. Nothing afterwards may rewrite them: a rollover
 * appends its own interest row and an overpayment/penalty has its own ledger,
 * but the ORIGINAL agreement stays byte-for-byte what the borrower accepted.
 *
 * This is a dispute tool. When a borrower says "I never agreed to 15%", the
 * lender shows the snapshot and its hash; any later edit would change the hash
 * and be detectable.
 *
 * Money is carried as STRINGS here (not BigInt) because the snapshot is
 * persisted as JSON, and `JSON.stringify` cannot serialise BigInt at all. The
 * strings are exactly the integer minor-unit values the ledger stores.
 */

import type { Frequency, Structure } from './schedule';

export const LOAN_TERMS_VERSION = 1;

export interface LoanTermsInstallment {
  seq: number;
  /** Date-only, `YYYY-MM-DD` (the Zambian civil due date). */
  dueDate: string;
  amountMinor: string;
}

export interface LoanTerms {
  version: number;
  principalMinor: string;
  rateBps: number;
  termCount: number;
  frequency: Frequency;
  repaymentStructure: Structure;
  feeMinor: string;
  disbursementMinor: string;
  totalDueMinor: string;
  firstDueDate: string;
  finalDueDate: string;
  installments: LoanTermsInstallment[];
}

export interface BuildLoanTermsInput {
  principalMinor: bigint;
  rateBps: number;
  termCount: number;
  frequency: Frequency;
  repaymentStructure: Structure;
  feeMinor: bigint;
  disbursementMinor: bigint;
  totalDueMinor: bigint;
  installments: ReadonlyArray<{ seq: number; dueDate: Date; amountMinor: bigint }>;
}

/** Date-only `YYYY-MM-DD` from a date-only value (UTC midnight). */
export function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function buildLoanTerms(input: BuildLoanTermsInput): LoanTerms {
  const installments = [...input.installments]
    .sort((a, b) => a.seq - b.seq)
    .map((i) => ({
      seq: i.seq,
      dueDate: dateOnly(i.dueDate),
      amountMinor: i.amountMinor.toString(),
    }));
  const first = installments[0]?.dueDate ?? '';
  const last = installments[installments.length - 1]?.dueDate ?? '';
  return {
    version: LOAN_TERMS_VERSION,
    principalMinor: input.principalMinor.toString(),
    rateBps: input.rateBps,
    termCount: input.termCount,
    frequency: input.frequency,
    repaymentStructure: input.repaymentStructure,
    feeMinor: input.feeMinor.toString(),
    disbursementMinor: input.disbursementMinor.toString(),
    totalDueMinor: input.totalDueMinor.toString(),
    firstDueDate: first,
    finalDueDate: last,
    installments,
  };
}

/**
 * Deterministic canonical JSON for hashing.
 *
 * Keys are emitted in a fixed order (never `Object.keys` order) so the same
 * terms always produce the same string regardless of how the object was built,
 * and the same terms re-derived on another server hash identically.
 */
export function loanTermsCanonicalJson(terms: LoanTerms): string {
  const parts: string[] = [
    `version:${terms.version}`,
    `principalMinor:${terms.principalMinor}`,
    `rateBps:${terms.rateBps}`,
    `termCount:${terms.termCount}`,
    `frequency:${terms.frequency}`,
    `repaymentStructure:${terms.repaymentStructure}`,
    `feeMinor:${terms.feeMinor}`,
    `disbursementMinor:${terms.disbursementMinor}`,
    `totalDueMinor:${terms.totalDueMinor}`,
    `firstDueDate:${terms.firstDueDate}`,
    `finalDueDate:${terms.finalDueDate}`,
    ...terms.installments.map(
      (i) => `installment:${i.seq}:${i.dueDate}:${i.amountMinor}`,
    ),
  ];
  return parts.join('|');
}

/** Human-facing summary of the frozen terms, for UI badges. */
export function describeLoanTerms(terms: LoanTerms): string {
  const rate = terms.rateBps / 100;
  const per =
    terms.frequency === 'weekly'
      ? 'week'
      : terms.frequency === 'fortnightly'
        ? 'fortnight'
        : 'month';
  return `${rate}% per ${per} · ${terms.termCount} ${terms.repaymentStructure === 'bullet' ? 'payment at maturity' : 'installments'}`;
}
