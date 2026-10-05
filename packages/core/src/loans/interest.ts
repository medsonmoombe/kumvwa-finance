/**
 * Interest accounting — splitting a flat-interest loan into the part that is
 * interest and the part that is principal/fee, so "generated from interest"
 * can be reported exactly rather than guessed from crude totals.
 *
 * The model: `buildSchedule` charges flat simple interest on the principal and
 * folds a one-off origination fee into the total. Therefore
 *
 *   nominalInterest = totalDue − principal − fee
 *
 * and that interest is spread across the ORIGINAL installments in proportion
 * to their size. A bullet loan has one installment that carries all of it.
 *
 * `interestPaid` is the pro-rata share of an installment's interest already
 * covered by what has been paid, floored to whole ngwee so the sum over
 * installments can never exceed the interest actually charged.
 */

export function nominalInterestMinor(
  totalDueMinor: bigint,
  principalMinor: bigint,
  feeMinor: bigint,
): bigint {
  const i = totalDueMinor - principalMinor - feeMinor;
  return i > 0n ? i : 0n;
}

/**
 * Distribute [interestMinor] over installment [amounts] in proportion to size,
 * with the final row absorbing rounding so Σ result === interestMinor exactly.
 * Zero-value installments get nothing.
 */
export function distributeInterest(
  amounts: readonly bigint[],
  interestMinor: bigint,
): bigint[] {
  const n = amounts.length;
  if (n === 0) return [];
  if (interestMinor <= 0n) return amounts.map(() => 0n);
  const total = amounts.reduce((s, a) => s + (a > 0n ? a : 0n), 0n);
  if (total <= 0n) return amounts.map(() => 0n);

  const out: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amount = amounts[i]! > 0n ? amounts[i]! : 0n;
    const share = isLast
      ? interestMinor - allocated
      : (interestMinor * amount) / total;
    out.push(share);
    allocated += share;
  }
  return out;
}

/**
 * The interest component of what has been paid toward one installment:
 * `floor(interestMinor * paid / amount)`, capped at `interestMinor`. Floored so
 * the ledger never recognises more interest than was charged.
 */
export function interestPaidOnInstallment(
  interestMinor: bigint,
  paidAmountMinor: bigint,
  amountMinor: bigint,
): bigint {
  if (interestMinor <= 0n || amountMinor <= 0n || paidAmountMinor <= 0n) return 0n;
  const paid = paidAmountMinor >= amountMinor ? amountMinor : paidAmountMinor;
  const share = (interestMinor * paid) / amountMinor;
  return share >= interestMinor ? interestMinor : share;
}
