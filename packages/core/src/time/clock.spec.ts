import {
  BUSINESS_TIME_ZONE,
  BUSINESS_UTC_OFFSET_MINUTES,
  businessDate,
  businessMonthBounds,
  businessMonthLabels,
  businessNow,
  daysBetween,
  endOfBusinessDay,
  startOfBusinessDay,
  startOfBusinessMonth,
  startOfBusinessMonthsAgo,
  startOfNextBusinessMonth,
} from './clock';

const iso = (d: Date) => d.toISOString();

describe('the business clock is Zambian time', () => {
  it('declares the zone it implements', () => {
    expect(BUSINESS_TIME_ZONE).toBe('Africa/Lusaka');
    expect(BUSINESS_UTC_OFFSET_MINUTES).toBe(120);
  });

  it('reads calendar components two hours ahead of UTC', () => {
    // 22:30 UTC on the 27th is already 00:30 on the 28th in Lusaka.
    const late = new Date('2026-09-27T22:30:00Z');
    expect(businessNow(late).getUTCFullYear()).toBe(2026);
    expect(businessNow(late).getUTCMonth()).toBe(8); // September
    expect(businessNow(late).getUTCDate()).toBe(28);
  });

  it('leaves the underlying instant untouched', () => {
    const now = new Date('2026-09-27T12:00:00Z');
    expect(businessNow(now).getTime() - now.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('reports the Lusaka date, not the UTC one, late at night', () => {
    expect(iso(businessDate(new Date('2026-09-27T22:30:00Z')))).toBe(
      '2026-09-28T00:00:00.000Z',
    );
    expect(iso(businessDate(new Date('2026-09-27T21:59:00Z')))).toBe(
      '2026-09-27T00:00:00.000Z',
    );
  });

  it('starts a business day at 22:00 UTC the day before', () => {
    expect(iso(startOfBusinessDay(businessDate()))).toMatch(
      /T22:00:00\.000Z$/,
    );
  });

  it('ends a business day at 23:59:59.999 Lusaka time', () => {
    const due = new Date('2026-09-27T00:00:00Z');
    const end = endOfBusinessDay(due);
    // 2026-09-27T21:59:59.999Z is 23:59:59.999 in Lusaka on the 27th.
    expect(iso(end)).toBe('2026-09-27T21:59:59.999Z');
    expect(iso(new Date(end.getTime() + 1))).toBe('2026-09-27T22:00:00.000Z');
  });

  it('counts whole days between dates without rounding drift', () => {
    const a = new Date('2026-09-27T00:00:00Z');
    expect(daysBetween(a, new Date('2026-10-27T00:00:00Z'))).toBe(30);
    expect(daysBetween(a, new Date('2026-10-12T00:00:00Z'))).toBe(15);
    expect(daysBetween(a, a)).toBe(0);
    expect(daysBetween(a, new Date('2026-08-15T00:00:00Z'))).toBe(-43);
  });

  it('spans a month boundary in Lusaka time', () => {
    const now = new Date('2026-09-30T23:00:00Z'); // 01:00 on 1 Oct in Lusaka
    const { first, next } = businessMonthBounds(now);
    expect(iso(first)).toBe('2026-10-01T00:00:00.000Z');
    expect(iso(next)).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('business month boundaries', () => {
  const now = new Date('2026-09-15T08:00:00Z');

  it('begins the month at midnight Lusaka time on the 1st', () => {
    expect(iso(startOfBusinessMonth(now))).toBe('2026-08-31T22:00:00.000Z');
  });

  it('ends it at the same instant one month on', () => {
    expect(iso(startOfNextBusinessMonth(now))).toBe('2026-09-30T22:00:00.000Z');
  });

  it('walks back whole months', () => {
    expect(iso(startOfBusinessMonthsAgo(5, now))).toBe(
      '2026-03-31T22:00:00.000Z',
    );
  });

  it('labels the trailing months oldest first, gaps included', () => {
    expect(businessMonthLabels(6, now)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
  });
});
