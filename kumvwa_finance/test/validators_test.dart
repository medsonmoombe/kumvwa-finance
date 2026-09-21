import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/utils/nrc_input_formatter.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';

void main() {
  group('Validators.required', () {
    test('rejects null, empty and whitespace-only values', () {
      expect(Validators.required(null), 'This field is required');
      expect(Validators.required(''), 'This field is required');
      expect(Validators.required('   '), 'This field is required');
    });

    test('uses the field name in the message', () {
      expect(
        Validators.required('', field: 'Client name'),
        'Client name is required',
      );
    });

    test('accepts a non-blank value', () {
      expect(Validators.required('Mwansa'), isNull);
    });
  });

  group('Validators.nrc', () {
    test('accepts the ######/##/# shape', () {
      expect(Validators.nrc('245711/63/1'), isNull);
      expect(Validators.nrc('  245711/63/1  '), isNull);
    });

    test('requires a value', () {
      expect(Validators.nrc(''), 'NRC number is required');
      expect(Validators.nrc(null), 'NRC number is required');
    });

    test('rejects malformed values', () {
      for (final bad in [
        '12345/63/1', // too few digits
        '245711/63/12', // too many digits in the last group
        '245711-63-1', // wrong separator
        '24571A/63/1', // non-digit
        '245711/6/1', // two-digit middle group required
      ]) {
        expect(Validators.nrc(bad), isNotNull, reason: 'should reject "$bad"');
      }
    });
  });

  group('Validators.zmPhone', () {
    test('accepts every Zambian mobile form', () {
      for (final ok in [
        '0971234567',
        '971234567',
        '+260971234567',
        '260971234567',
        '09 712 345 67',
        '0761234567',
      ]) {
        expect(Validators.zmPhone(ok), isNull, reason: 'should accept "$ok"');
      }
    });

    test('requires a value', () {
      expect(Validators.zmPhone(''), 'Phone number is required');
      expect(Validators.zmPhone(null), 'Phone number is required');
    });

    test('rejects non-mobile and malformed numbers', () {
      for (final bad in ['0612345678', '097123456', '09712345678', 'abc']) {
        expect(
          Validators.zmPhone(bad),
          isNotNull,
          reason: 'should reject "$bad"',
        );
      }
    });
  });

  group('Validators.password', () {
    test('requires a value', () {
      expect(Validators.password(''), 'Password is required');
      expect(Validators.password(null), 'Password is required');
    });

    test('enforces a 6 character minimum', () {
      expect(Validators.password('12345'), 'Must be at least 6 characters');
      expect(Validators.password('123456'), isNull);
    });
  });

  group('Validators.adultDob', () {
    test('requires a value', () {
      expect(Validators.adultDob(null), 'Date of birth is required');
    });

    test('accepts exactly 18 today', () {
      final now = DateTime.now();
      expect(
        Validators.adultDob(DateTime(now.year - 18, now.month, now.day)),
        isNull,
      );
    });

    test('rejects under 18', () {
      final now = DateTime.now();
      expect(
        Validators.adultDob(DateTime(now.year - 17, now.month, now.day)),
        'You must be at least 18 years old',
      );
    });
  });

  group('NrcInputFormatter', () {
    TextEditingValue run(String text) => NrcInputFormatter().formatEditUpdate(
      TextEditingValue.empty,
      TextEditingValue(text: text),
    );

    test('inserts separators at positions 6 and 8', () {
      expect(run('245711631').text, '245711/63/1');
      expect(run('2457116').text, '245711/6');
      expect(run('24571163').text, '245711/63');
    });

    test('never leaves a trailing separator', () {
      expect(run('245711').text, '245711');
      expect(run('24571163').text, '245711/63');
    });

    test('strips non-digits as the user pastes', () {
      expect(run('245-711/631').text, '245711/63/1');
      expect(run('abc245711631xyz').text, '245711/63/1');
    });

    test('caps the input at 9 digits', () {
      expect(run('2457116319999').text, '245711/63/1');
    });

    test('collapses the caret to the end', () {
      expect(run('245711631').selection, const TextSelection.collapsed(offset: 11));
    });

    test('keeps partial input intact when deleting', () {
      expect(run('2457163').text, '245716/3');
    });
  });
}
