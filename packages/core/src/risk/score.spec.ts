import { bandFromScore, creditLimitKwacha, internalScore } from './score';
import type { RepaymentHistory } from './score';

const history = (patch: Partial<RepaymentHistory> = {}): RepaymentHistory => ({
  loansTotal: 0,
  loansCleared: 0,
  installmentsPaidOnTime: 0,
  installmentsLate: 0,
  daysOverdueWorst: 0,
  ...patch,
});

describe('internal scoring', () => {
  it('returns null with no borrowing history', () => {
    expect(internalScore(history())).toBeNull();
  });

  it('scores a cleared first loan at 650 (600 + 2×15 + 20)', () => {
    expect(  // matches the B4 e2e fixture
      internalScore(
        history({
          loansTotal: 1,
          loansCleared: 1,
          installmentsPaidOnTime: 2,
        }),
      ),
    ).toBe(650);
  });

  it('penalises late installments and overdue days', () => {
    expect(
      internalScore(history({ loansTotal: 1, installmentsLate: 2 })),
    ).toBe(520);
    expect(
      internalScore(
        history({ loansTotal: 1, installmentsLate: 1, daysOverdueWorst: 30 }),
      ),
    ).toBe(530);
  });

  it('caps bonuses and penalties', () => {
    expect(
      internalScore(history({ loansTotal: 1, installmentsPaidOnTime: 99 })),
    ).toBe(660);
    expect(
      internalScore(history({ loansTotal: 1, installmentsLate: 99 })),
    ).toBe(400);
  });

  it('bands the score', () => {
    expect(bandFromScore(700)).toBe('low');
    expect(bandFromScore(650)).toBe('medium');
    expect(bandFromScore(500)).toBe('high');
  });
});

describe('credit limit ladder', () => {
  it('falls back to the configured no-history limit', () => {
    expect(creditLimitKwacha(null, 1000)).toBe(1000);
    expect(creditLimitKwacha(null, 2500)).toBe(2500);
  });

  it('maps scores to the kwacha ladder', () => {
    expect(creditLimitKwacha(800, 1000)).toBe(15000);
    expect(creditLimitKwacha(750, 1000)).toBe(15000);
    expect(creditLimitKwacha(700, 1000)).toBe(10000);
    expect(creditLimitKwacha(650, 1000)).toBe(5000); // cleared-first-loan case
    expect(creditLimitKwacha(600, 1000)).toBe(5000);
    expect(creditLimitKwacha(550, 1000)).toBe(3000);
    expect(creditLimitKwacha(400, 1000)).toBe(1500);
  });
});
