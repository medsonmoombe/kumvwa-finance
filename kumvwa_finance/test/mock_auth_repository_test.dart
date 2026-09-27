import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/storage/token_store.dart';
import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';

void main() {
  setUp(() {
    // Keystore out of the picture — this is a pure logic test.
    FlutterSecureStorage.setMockInitialValues({});
  });

  MockAuthRepository repo() => MockAuthRepository(TokenStore());

  group('MockAuthRepository.login', () {
    // AppPhoneField's controller holds the national number only: the "+260"
    // the user sees lives in the flag prefix and never reaches the repo. So a
    // valid login must work with or without the trunk 0.
    const accepted = <String, String>{
      '971234567': 'typed against the +260 prefix — no trunk 0',
      '0971234567': 'national with trunk 0',
      '09 712 345 67': 'spaced digits',
      '+260971234567': 'E.164',
      '260971234567': 'dial code without +',
    };

    accepted.forEach((phone, description) {
      test('accepts "$phone" ($description)', () async {
        final session = await repo().login(phone: phone, password: 'kumvwa123');
        expect(session.phone, '0971234567');
        expect(session.role, 'business');
      });
    });

    test('rejects a wrong password', () async {
      await expectLater(
        repo().login(phone: '971234567', password: 'nope-not-the-one'),
        throwsA(isA<AuthException>()),
      );
    });

    test('rejects an unknown number', () async {
      await expectLater(
        repo().login(phone: '0960000000', password: 'kumvwa123'),
        throwsA(isA<AuthException>()),
      );
    });
  });

  group('client demo account', () {
    test('logs in and returns the borrower session', () async {
      final session = await repo().login(
        phone: '0971112233',
        password: 'kumvwa123',
      );

      expect(session.role, 'client');
      expect(session.userId, 'clt_001');
      expect(session.displayName, 'Mwansa Bwalya');
      expect(session.phone, '0971112233');
    });

    test('also accepts the client number without the trunk 0', () async {
      final session = await repo().login(
        phone: '971112233',
        password: 'kumvwa123',
      );

      expect(session.role, 'client');
    });

    test('the business account still works after adding the client', () async {
      final session = await repo().login(
        phone: '971234567',
        password: 'kumvwa123',
      );

      expect(session.role, 'business');
      expect(session.userId, 'biz_001');
    });

    test('the client number rejects the wrong password', () async {
      await expectLater(
        repo().login(phone: '0971112233', password: 'nope'),
        throwsA(isA<AuthException>()),
      );
    });
  });

  group('session restore', () {
    test('returns null when nothing is stored', () async {
      expect(await repo().restoreSession(), isNull);
    });

    test('round-trips a stored session', () async {
      await repo().login(phone: '971234567', password: 'kumvwa123');
      final restored = await repo().restoreSession();
      expect(restored?.displayName, 'Chilenje Community SACCO');
      expect(restored?.role, 'business');
    });

    test('logout clears the stored session', () async {
      final repository = repo();
      await repository.login(phone: '971234567', password: 'kumvwa123');
      await repository.logout();
      expect(await repository.restoreSession(), isNull);
    });
  });
}
