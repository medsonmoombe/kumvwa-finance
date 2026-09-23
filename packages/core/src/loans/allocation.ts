/**
 * Repayment allocation — the pure money math behind recording a payment.
 *
 * Kept here (not in the API service) because this decides how real money is
 * credited to a borrower's instalments: it must be testable in isolation from
 * Prisma, HTTP and transactions.
 */

export type InstallmentState = 'pending' | 'paid' | 'overdue';

export interface AllocatableInstallment {
  id: string;
  seq: number;
  amountMinor: bigint;
  paidAmountMinor: bigint;
  status: InstallmentState;
}

export interface AllocationChange {
  id: string;
  paidAmountMinor: bigint;
  /** `paid` once fully settled, otherwise the installment's prior status. */
  status: InstallmentState;
  settled: boolean;
}

export interface AllocationResult {
  changes: AllocationChange[];
  /** How much of the payment was credited to instalments. */
  appliedMinor: bigint;
  /**
   * Anything that could not be credited. Callers cap the payment at the
   * outstanding balance, so this should be 0n — it exists so the caller can
   * notice if that guard ever regresses.
   */
  unappliedMinor: bigint;
}

/**
 * Credits `amountMinor` against instalments oldest-first, which is the order
 * money is owed. Installments already settled are skipped.
 *
 * There is no "partially paid" status in the data model, so a partial payment
 * leaves the installment's existing status (pending/overdue) in place and only
 * promotes it to `paid` once the full amount is covered.
 *
 * Does not mutate `installments`.
 */
export function allocateRepayment(
  amountMinor: bigint,
  installments: readonly AllocatableInstallment[],
): AllocationResult {
  if (amountMinor <= 0n) {
    throw new Error('amount must be a positive number of minor units');
  }

  // Defensive sort: callers pass seq-ascending rows, but the order of money is
  // too important to inherit from a database ORDER BY.
  const ordered = [...installments].sort((a, b) => a.seq - b.seq);

  let remaining = amountMinor;
  const changes: AllocationChange[] = [];

  for (const inst of ordered) {
    if (remaining <= 0n) break;

    const owed = inst.amountMinor - inst.paidAmountMinor;
    if (owed <= 0n) continue; // already settled

    const applied = remaining < owed ? remaining : owed;
    const paid = inst.paidAmountMinor + applied;
    const settled = paid >= inst.amountMinor;

    changes.push({
      id: inst.id,
      paidAmountMinor: paid,
      status: settled ? 'paid' : inst.status,
      settled,
    });

    remaining -= applied;
  }

  return {
    changes,
    appliedMinor: amountMinor - remaining,
    unappliedMinor: remaining,
  };
}
