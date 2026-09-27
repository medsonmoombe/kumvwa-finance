import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';

import 'package:kumvwa_finance/core/utils/format.dart';

void main() {
  // Pin the locale — NumberFormat uses the ambient locale for grouping
  // and month names.
  setUpAll(() => Intl.defaultLocale = 'en_US');

  group('Fmt.money', () {
    test('formats whole numbers with thousands separators', () {
      expect(Fmt.money(245800), 'K 245,800');
      expect(Fmt.money(1200), 'K 1,200');
      expect(Fmt.money(0), 'K 0');
    });

    test('respects the decimals argument', () {
      expect(Fmt.money(9775.3333, decimals: 2), 'K 9,775.33');
      expect(Fmt.money(3258.7), 'K 3,259');
    });
  });

  group('Fmt.date', () {
    test('formats as d MMM yyyy', () {
      expect(Fmt.date(DateTime(2025, 8, 12)), '12 Aug 2025');
      expect(Fmt.date(DateTime(2025, 12, 1)), '1 Dec 2025');
    });
  });

  group('Fmt.initials', () {
    test('uses the first and last name', () {
      expect(Fmt.initials('Mwansa Bwalya'), 'MB');
      expect(Fmt.initials('Nasilele Mwiya'), 'NM');
      expect(Fmt.initials('A B C'), 'AC');
    });

    test('handles a single name', () {
      expect(Fmt.initials('Chanda'), 'C');
    });

    test('collapses extra whitespace and upper-cases', () {
      expect(Fmt.initials('  mwansa   bwalya  '), 'MB');
    });

    test('falls back to ? for a blank name', () {
      expect(Fmt.initials('   '), '?');
      expect(Fmt.initials(''), '?');
    });
  });

  group('Fmt.maskPhone', () {
    test('masks a local number', () {
      expect(Fmt.maskPhone('0971234567'), '+260 97 ••• 4567');
    });

    test('masks an E.164 number the same way', () {
      expect(Fmt.maskPhone('+260971234567'), '+260 97 ••• 4567');
    });

    test('never exposes the middle digits', () {
      final masked = Fmt.maskPhone('0977654321');
      expect(masked.contains('765'), isFalse);
      expect(masked, '+260 97 ••• 4321');
    });

    test('degrades to a placeholder when the input is unusable', () {
      expect(Fmt.maskPhone(''), '••• ••••');
      expect(Fmt.maskPhone('123'), '••• ••••');
    });
  });
}
