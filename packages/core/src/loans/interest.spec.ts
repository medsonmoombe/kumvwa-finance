import {
  distributeInterest,
  interestPaidOnInstallment,
  nominalInterestMinor,
} from './interest';

describe('nominalInterestMinor', () => {
  it('is totalDue minus principal minus fee', () => {
    expect(nominalInterestMinor(120_000n, 100_000n, 5_000n)).toBe(15_000n);
  });
  it('never goes negative', () => {
    expect(nominalInterestMinor(1_000n, 2_000n, 0n)).toBe(0n);
  });
});

describe('distributeInterest', () => {
  it('sums exactly to the interest, last row absorbing rounding', () => {
    const parts = distributeInterest([40_000n, 40_000n, 40_000n], 15_001n);
    expect(parts.reduce((s, x) => s + x, 0n)).toBe(15_001n);
  });

  it('is proportional to installment size', () => {
    const parts = distributeInterest([100n, 300n], 400n);
    expect(parts).toEqual([100n, 300n]);
  });

  it('handles a bullet loan (single installment) as all interest', () => {
    expect(distributeInterest([120_000n], 15_000n)).toEqual([15_000n]);
  });

  it('returns zeros when there is no interest', () => {
    expect(distributeInterest([1n, 1n], 0n)).toEqual([0n, 0n]);
  });
});

describe('interestPaidOnInstallment', () => {
  it('is pro-rata and floors', () => {
    // 15_000 interest over a 40_000 installment, half paid => 7_500
    expect(interestPaidOnInstallment(15_000n, 20_000n, 40_000n)).toBe(7_500n);
  });
  it('caps at the interest charged when fully paid', () => {
    expect(interestPaidOnInstallment(15_000n, 40_000n, 40_000n)).toBe(15_000n);
    expect(interestPaidOnInstallment(15_000n, 99_999n, 40_000n)).toBe(15_000n);
  });
  it('is zero with nothing paid', () => {
    expect(interestPaidOnInstallment(15_000n, 0n, 40_000n)).toBe(0n);
  });
});
