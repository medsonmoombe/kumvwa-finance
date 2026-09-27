import { bpsOf } from '../money';
import type { Ngwee } from '../money';

export type FeeTreatment = 'add' | 'deduct';

export interface FeePlan {
  feeMinor: Ngwee;
  /** What the borrower actually receives at disbursement. */
  disbursementMinor: Ngwee;
}

/**
 * Origination fee. Total due always includes the fee; the treatment only
 * changes the payout: 'add' pays out full principal, 'deduct' nets the fee
 * off the disbursement. Fee is capped at 20% (2000 bps) of principal.
 */
export function originationFee(
  principalMinor: Ngwee,
  feeBps: number,
  treatment: FeeTreatment,
): FeePlan {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 2000) {
    throw new Error('feeBps must be 0..2000 (max 20%)');
  }
  const feeMinor = bpsOf(principalMinor, feeBps);
  return {
    feeMinor,
    disbursementMinor:
      treatment === 'deduct' ? principalMinor - feeMinor : principalMinor,
  };
}
