import {
  kwachaToMinor,
  minorToKwacha,
  minorToKwachaString,
  formatMinor,
} from './money';

describe('money', () => {
  it('converts kwacha to minor units', () => {
    expect(kwachaToMinor(800)).toBe(80000n);
    expect(kwachaToMinor(0.01)).toBe(1n);
    expect(kwachaToMinor(1234.56)).toBe(123456n);
  });

  it('rounds float drift to the nearest ngwee', () => {
    expect(kwachaToMinor(153.33)).toBe(15333n);
    expect(kwachaToMinor(0.1 + 0.2)).toBe(30n);
  });

  it('rejects non-finite input', () => {
    expect(() => kwachaToMinor(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => kwachaToMinor(Number.NaN)).toThrow();
  });

  it('converts back to kwacha', () => {
    expect(minorToKwacha(80000n)).toBe(800);
  });

  it('formats exact decimal strings', () => {
    expect(minorToKwachaString(92000n)).toBe('920.00');
    expect(minorToKwachaString(5n)).toBe('0.05');
    expect(minorToKwachaString(-15333n)).toBe('-153.33');
    expect(formatMinor(92000n)).toBe('K 920.00');
  });
});
