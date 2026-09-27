/// The business clock, on the client side.
///
/// A loan's due date is a *Zambian civil date* — the day a Zambian borrower
/// would read off a calendar — not an instant. Counting down to it therefore
/// has to be done against Zambia's "today", not the phone's: a handset set to
/// UTC would otherwise show a day-count that is two hours out of step, and a
/// borrower travelling outside Zambia would see their due date shift.
///
/// Africa/Lusaka is UTC+2 (Central Africa Time) and has observed no daylight
/// saving since 1994, so a fixed offset is exact. Keep this in step with
/// `BUSINESS_UTC_OFFSET_MINUTES` in `packages/core/src/time/clock.ts`.
library;

const Duration businessUtcOffset = Duration(hours: 2);

/// The current instant expressed in Zambian wall-clock time.
DateTime zambiaNow([DateTime? at]) {
  final now = at ?? DateTime.now();
  return now.toUtc().add(businessUtcOffset);
}

/// Today in Zambia, as a local DateTime pinned to midnight.
///
/// Midnight local (rather than UTC) so it can be subtracted from any other
/// date-only value produced by [dateOnly] without dragging a timezone offset
/// into the difference.
DateTime zambiaToday([DateTime? at]) {
  final z = zambiaNow(at);
  return DateTime(z.year, z.month, z.day);
}

/// Strips the time component, so only the calendar day is compared.
///
/// The API sends due dates as bare `YYYY-MM-DD` (a Postgres `DATE`), which
/// Dart parses as local midnight already; a due date that arrives as a UTC
/// instant is re-projected here so both forms compare equal.
DateTime dateOnly(DateTime value) =>
    DateTime(value.year, value.month, value.day);

/// Whole days from today in Zambia until [dueDate]. Negative once it is past,
/// and 0 on the day itself — so a loan is never shown as overdue on its due
/// date, only after it.
int daysUntilZambianDate(DateTime dueDate, [DateTime? at]) =>
    dateOnly(dueDate).difference(zambiaToday(at)).inDays;
