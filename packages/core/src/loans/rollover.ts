import { addFrequency } from './schedule';
import type { Ngwee } from '../money';

export interface RolloverInstallment {
  seq: number;
  dueDate: Date;
  amountMinor: Ngwee;
  paidAmountMinor: Ngwee;
  /** Interest baked into this installment (from distributeInterest). */
  interestMinor: Ngwee;
}

export interface RolloverInput {
  installments: RolloverInstallment[];
  rolloverCount: number;
  maxRollovers: number;
  /** Principal of the loan — used for the total-cost cap. */
  principalMinor: Ngwee;
}

export interface RolloverPlan {
  /** The interest-only fee the client pays now to extend. */
  extensionFeeMinor: Ngwee;
  /** Backward-compat alias — same value as extensionFeeMinor. */
  paymentMinor: Ngwee;
  shifts: Array<{ seq: number; newDueDate: Date }>;
  newTotalDueMinor: Ngwee;
}

/**
 * "Pay remaining interest & extend all due dates by one month."
 *
 * Rules:
 *  1. Only one extension is allowed per loan lifetime (maxRollovers = 1).
 *  2. The extension fee = sum of interestMinor on ALL unpaid installments.
 *     This is the interest the client still owes — not a new charge.
 *     Example: K200 loan, 15% flat, 2 months, client paid installment 1 (K115):
 *       remaining interest = interestMinor on installment 2 only = K15
 *       extension fee = K15
 *  3. Total cost cap: principal + all interest ever charged (original + fee)
 *     must not exceed 2× principal. Rejects if it would.
 *  4. Every UNPAID installment shifts +1 month. Paid installments are untouched.
 *  5. NO new installment is appended. The extension fee is recorded only as a
 *     repayment row (kind='rollover_interest') — the schedule stays clean.
 *  6. totalDue grows by the fee; paidAmount grows by the fee via the repayment
 *     row → outstanding is UNCHANGED by the extension itself.
 */
export function rolloverPlan(input: RolloverInput): RolloverPlan {
  if (input.rolloverCount >= input.maxRollovers) {
    throw new Error(
      'This loan has already been extended once. No further extensions are allowed.',
    );
  }

  const unpaid = input.installments.filter(
    (i) => i.paidAmountMinor < i.amountMinor,
  );
  if (unpaid.length === 0) {
    throw new Error('This loan is already fully repaid.');
  }

  // Extension fee = sum of remaining interest on unpaid installments only.
  // interestPaidOnInstallment is floored, so remaining = interestMinor - paid share.
  const extensionFeeMinor = unpaid.reduce((sum, i) => {
    if (i.interestMinor <= 0n) return sum;
    // Interest already collected on this installment (pro-rata of what was paid).
    const interestAlreadyPaid =
      i.paidAmountMinor > 0n && i.amountMinor > 0n
        ? (i.interestMinor * i.paidAmountMinor) / i.amountMinor
        : 0n;
    const remaining = i.interestMinor - interestAlreadyPaid;
    return sum + (remaining > 0n ? remaining : 0n);
  }, 0n);

  if (extensionFeeMinor <= 0n) {
    throw new Error(
      'No interest remains on this loan — extension is not applicable.',
    );
  }

  // Total-cost cap: the client must never pay more than 2× the principal.
  // totalDue already includes original interest; adding the fee must not breach the cap.
  const currentTotalDue = input.installments.reduce(
    (s, i) => s + i.amountMinor,
    0n,
  );
  const cap = input.principalMinor * 2n;
  if (currentTotalDue + extensionFeeMinor > cap) {
    throw new Error(
      `Extension would cause total repayable to exceed 2× the principal (K${Number(cap) / 100}). Extension not allowed.`,
    );
  }

  return {
    extensionFeeMinor,
    paymentMinor: extensionFeeMinor, // backward-compat
    shifts: unpaid.map((i) => ({
      seq: i.seq,
      newDueDate: addFrequency(i.dueDate, 1, 'monthly'),
    })),
    newTotalDueMinor: currentTotalDue + extensionFeeMinor,
  };
}

// ── Bullet loan extension ────────────────────────────────────────────────────

export interface BulletRolloverPlan {
  extensionFeeMinor: Ngwee;
  paymentMinor: Ngwee;
  newDueDate: Date;
  amountIncreaseMinor: Ngwee;
  newTotalDueMinor: Ngwee;
}

/**
 * Extension for bullet loans (single installment).
 * Same rules as above — fee = remaining interest on the installment,
 * maturity shifts +1 month, no new installment appended.
 */
export function rolloverBulletPlan(input: {
  dueDate: Date;
  amountMinor: Ngwee;
  paidAmountMinor: Ngwee;
  interestMinor: Ngwee;
  rolloverCount: number;
  maxRollovers: number;
  principalMinor: Ngwee;
}): BulletRolloverPlan {
  if (input.rolloverCount >= input.maxRollovers) {
    throw new Error(
      'This loan has already been extended once. No further extensions are allowed.',
    );
  }
  if (input.paidAmountMinor >= input.amountMinor) {
    throw new Error('This loan is already fully repaid.');
  }

  // Remaining interest = total interest - interest already collected pro-rata.
  const interestAlreadyPaid =
    input.paidAmountMinor > 0n && input.amountMinor > 0n
      ? (input.interestMinor * input.paidAmountMinor) / input.amountMinor
      : 0n;
  const extensionFeeMinor = input.interestMinor - interestAlreadyPaid;

  if (extensionFeeMinor <= 0n) {
    throw new Error(
      'No interest remains on this loan — extension is not applicable.',
    );
  }

  // Total-cost cap.
  const cap = input.principalMinor * 2n;
  if (input.amountMinor + extensionFeeMinor > cap) {
    throw new Error(
      `Extension would cause total repayable to exceed 2× the principal (K${Number(cap) / 100}). Extension not allowed.`,
    );
  }

  return {
    extensionFeeMinor,
    paymentMinor: extensionFeeMinor,
    newDueDate: addFrequency(input.dueDate, 1, 'monthly'),
    amountIncreaseMinor: extensionFeeMinor,
    newTotalDueMinor: input.amountMinor + extensionFeeMinor,
  };
}
