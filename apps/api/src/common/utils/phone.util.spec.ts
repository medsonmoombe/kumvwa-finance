import { normalizeZmPhone } from './phone.util';

describe('normalizeZmPhone', () => {
  it.each([
    ['0971234567', '+260971234567'],
    ['+260971234567', '+260971234567'],
    ['260971234567', '+260971234567'],
    ['971234567', '+260971234567'],
    ['097 123 4567', '+260971234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeZmPhone(input)).toBe(expected);
  });

  it.each(['12345', '0112345678', '', 'abc'])('rejects %s', (input) => {
    expect(normalizeZmPhone(input)).toBeNull();
  });
});
