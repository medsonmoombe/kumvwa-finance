import { addFrequency } from './schedule';
import type { Ngwee } from '../money';

export interface RolloverInstallment {
  seq: number;
  dueDate: Date;
  amountMinor: Ngwee;
  paidAmountMinor: Ngwee;
}

export interface RolloverInput {
  installments: RolloverInstallment[];
  /** One month's interest share — the fixed cost of carrying over. */
  interestShareMinor: Ngwee;
  today: Date;
  rolloverCount: number;
  maxRollovers: number;
}

export interface RolloverPlan {
  /** The interest-only payment the client makes now. */
  paymentMinor: Ngwee;
  shifts: Array<{ seq: number; newDueDate: Date }>;
  appended: { seq: number; dueDate: Date; amountMinor: Ngwee };
  newTotalDueMinor: Ngwee;
}

/**
 * "Pay interest & carry over by one month":
 *  - client pays [interestShare] now (recorded as a repayment),
 *  - every UNPAID due date shifts +1 month,
 *  - one interest-only installment is appended at the end.
 *
 * Invariants: Σ amounts after = Σ before + share; outstanding unchanged
 * (paid and totalDue both grow by share); dates strictly increasing.
 */
export function rolloverPlan(input: RolloverInput): RolloverPlan {
  if (input.rolloverCount >= input.maxRollovers) {
    throw new Error('Rollover limit reached');
  }
  if (input.interestShareMinor <= 0n) {
    throw new Error('Nothing to carry');
  }
  const unpaid = input.installments.filter(
    (i) => i.paidAmountMinor < i.amountMinor,
  );
  if (unpaid.length === 0) throw new Error('Loan already cleared');

  const last = input.installments.reduce((a, b) => (b.seq > a.seq ? b : a));
  const sumBefore = input.installments.reduce(
    (a, i) => a + i.amountMinor,
    0n,
  );

  // The appended installment must land strictly AFTER every shifted due
  // date — so anchor it one month past the latest post-shift obligation,
  // not one month past the original last date (those coincide when the
  // last installment itself is unpaid, and would collide).
  const lastShiftedDate = unpaid.reduce(
    (a, i) => {
      const shifted = addFrequency(i.dueDate, 1, 'monthly');
      return shifted > a ? shifted : a;
    },
    new Date(0),
  );

  return {
    paymentMinor: input.interestShareMinor,
    shifts: unpaid.map((i) => ({
      seq: i.seq,
      newDueDate: addFrequency(i.dueDate, 1, 'monthly'),
    })),
    appended: {
      seq: last.seq + 1,
      dueDate: addFrequency(lastShiftedDate, 1, 'monthly'),
      amountMinor: input.interestShareMinor,
    },
    newTotalDueMinor: sumBefore + input.interestShareMinor,
  };
}

export interface BulletRolloverPlan {
  paymentMinor: Ngwee;
  newDueDate: Date;
  /** Grows the single installment (and totalDue) by the carry cost. */
  amountIncreaseMinor: Ngwee;
  newTotalDueMinor: Ngwee;
}

/**
 * "Pay interest & extend +1 month" for bullet loans: the client pays one
 * month's interest share, the maturity moves +1 month, and totalDue grows by
 * the share. Invariant: outstanding is UNCHANGED by the rollover itself
 * (paidAmount and totalDue both grow by the share via the repayment row).
 */
export function rolloverBulletPlan(input: {
  dueDate: Date;
  amountMinor: Ngwee;
  paidAmountMinor: Ngwee;
  interestShareMinor: Ngwee;
  rolloverCount: number;
  maxRollovers: number;
}): BulletRolloverPlan {
  if (input.rolloverCount >= input.maxRollovers) {
    throw new Error('Rollover limit reached');
  }
  if (input.interestShareMinor <= 0n) throw new Error('Nothing to carry');
  if (input.paidAmountMinor >= input.amountMinor) {
    throw new Error('Loan already cleared');
  }
  return {
    paymentMinor: input.interestShareMinor,
    newDueDate: addFrequency(input.dueDate, 1, 'monthly'),
    amountIncreaseMinor: input.interestShareMinor,
    newTotalDueMinor: input.amountMinor + input.interestShareMinor,
  };
}
