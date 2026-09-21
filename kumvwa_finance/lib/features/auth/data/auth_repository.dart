import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/storage/token_store.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';

/// Thrown for expected auth failures (bad credentials etc.).
/// Message is safe to show directly to the user.
class AuthException implements Exception {
  const AuthException(this.message);
  final String message;
}

abstract class AuthRepository {
  /// Returns the restored session, or null if not logged in.
  Future<UserSession?> restoreSession();

  Future<UserSession> login({required String phone, required String password});

  Future<void> logout();
}

// ---------- MOCK — swap for ApiAuthRepository when the backend exists ----------

class MockAuthRepository implements AuthRepository {
  MockAuthRepository(this._tokenStore);

  final TokenStore _tokenStore;

  /// Demo accounts, shown on the login screen while in mock mode.
  static const _accounts =
      <String, ({String password, UserSession session})>{
    '0971234567': (
      password: 'kumvwa123',
      session: UserSession(
        token: 'mock-jwt-business',
        userId: 'biz_001',
        displayName: 'Chilenje Community SACCO',
        phone: '0971234567',
        role: 'business',
      ),
    ),
    '0971112233': (
      password: 'kumvwa123',
      session: UserSession(
        token: 'mock-jwt-client',
        userId: 'clt_001',
        displayName: 'Mwansa Bwalya',
        phone: '0971112233',
        role: 'client',
      ),
    ),
  };

  /// Canonicalises whatever the phone field hands us into the national
  /// `0XXXXXXXXX` form used by [_mockPhone].
  ///
  /// `AppPhoneField`'s controller holds ONLY the digits the user typed —
  /// the `+260` dial code lives in the field's flag prefix and never
  /// reaches us. So "971234567" must gain its trunk 0 here; without that
  /// a perfectly valid entry fails as "invalid phone number or password".
  static String _normalize(String phone) {
    var p = phone.replaceAll(RegExp(r'[\s()\-]'), '');
    if (p.startsWith('+260')) {
      p = p.substring(4); // E.164 form
    } else if (p.startsWith('260')) {
      p = p.substring(3);
    }
    // Zambian mobile numbers are 9 digits national, 10 with the trunk 0.
    // Only mobile prefixes (97/96/95) gain the trunk 0 — the +260 prefix is
    // preselected in the phone field, so users naturally type "971234567".
    if (p.length == 9 && RegExp(r'^[97]').hasMatch(p)) p = '0$p';
    return p;
  }

  @override
  Future<UserSession?> restoreSession() => _tokenStore.readSession();

  @override
  Future<UserSession> login({
    required String phone,
    required String password,
  }) async {
    await Future<void>.delayed(
      const Duration(milliseconds: 900),
    ); // fake latency

    final account = _accounts[_normalize(phone)];
    if (account == null || password != account.password) {
      throw const AuthException('Invalid phone number or password');
    }

    await _tokenStore.saveSession(account.session);
    return account.session;
  }

  @override
  Future<void> logout() => _tokenStore.clear();
}

// ---------- DI ----------

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => MockAuthRepository(ref.watch(tokenStoreProvider)),
);
