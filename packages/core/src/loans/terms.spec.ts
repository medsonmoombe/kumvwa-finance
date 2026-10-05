import { buildLoanTerms, loanTermsCanonicalJson, describeLoanTerms } from './terms';

const input = {
  principalMinor: 100_000n,
  rateBps: 1500,
  termCount: 3,
  frequency: 'monthly' as const,
  repaymentStructure: 'installments' as const,
  feeMinor: 5_000n,
  disbursementMinor: 100_000n,
  totalDueMinor: 120_000n,
  installments: [
    { seq: 2, dueDate: new Date('2026-03-01T00:00:00.000Z'), amountMinor: 40_000n },
    { seq: 1, dueDate: new Date('2026-02-01T00:00:00.000Z'), amountMinor: 40_000n },
    { seq: 3, dueDate: new Date('2026-04-01T00:00:00.000Z'), amountMinor: 40_000n },
  ],
};

describe('buildLoanTerms', () => {
  it('captures the issued terms and a sorted schedule', () => {
    const t = buildLoanTerms(input);
    expect(t.principalMinor).toBe('100000');
    expect(t.rateBps).toBe(1500);
    expect(t.termCount).toBe(3);
    expect(t.installments.map((i) => i.seq)).toEqual([1, 2, 3]);
    expect(t.firstDueDate).toBe('2026-02-01');
    expect(t.finalDueDate).toBe('2026-04-01');
  });

  it('emits the same canonical JSON regardless of installment input order', () => {
    const a = buildLoanTerms(input);
    const shuffled = buildLoanTerms({
      ...input,
      installments: [...input.installments].reverse(),
    });
    expect(loanTermsCanonicalJson(a)).toBe(loanTermsCanonicalJson(shuffled));
  });

  it('changes the canonical JSON when any term changes', () => {
    const a = buildLoanTerms(input);
    const b = buildLoanTerms({ ...input, rateBps: 2000 });
    expect(loanTermsCanonicalJson(a)).not.toBe(loanTermsCanonicalJson(b));
  });

  it('describes the terms for display', () => {
    expect(describeLoanTerms(buildLoanTerms(input))).toBe(
      '15% per month · 3 installments',
    );
  });
});
