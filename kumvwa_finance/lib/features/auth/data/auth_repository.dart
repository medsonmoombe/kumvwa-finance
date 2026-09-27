import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
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
  static const _accounts = <String, ({String password, UserSession session})>{
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
        // Matches MockClientsRepository.getMe: the invite only minted the
        // account, so the KYC wizard greets a freshly logged-in borrower.
        profileComplete: false,
        profilePercent: 40,
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

// ---------- API-backed implementation ----------

/// Real backend auth via `/auth/login`, `/auth/refresh`, `/auth/me` and
/// `/auth/logout`. Tokens live in [ApiClient]; [TokenStore] persists them.
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository({required this.client, required this.tokenStore});

  final ApiClient client;
  final TokenStore tokenStore;

  @override
  Future<UserSession?> restoreSession() async {
    final access = await client.restoreTokens();
    if (access == null) return null;

    // Revalidate against the server: upgrades a stale refresh token and
    // keeps displayName/role fresh. The 401 path already cleared the
    // session via the interceptor, so a failure simply means logged out.
    try {
      final res = await client.getA('/auth/me');
      final user = res.data as Map<String, dynamic>;
      final session = UserSession(
        token: client.accessToken ?? access,
        userId: user['userId'] as String? ?? '',
        displayName: user['displayName'] as String? ?? '',
        phone: user['phone'] as String? ?? '',
        role: toAppRole(user['role'] as String? ?? 'client'),
        refreshToken: client.refreshToken,
        profileComplete: user['profileComplete'] as bool? ?? true,
        profilePercent: user['profilePercent'] as int? ?? 100,
      );
      await tokenStore.saveSession(session);
      return session;
    } catch (e) {
      if (e is DioException &&
          e.response?.statusCode == 401 &&
          client.lastRefreshWasAuthRejected) {
        return null;
      }
      // Offline / server down — keep the cached session rather than
      // force-logging-out someone who can't reach us.
      return tokenStore.readSession();
    }
  }

  @override
  Future<UserSession> login({
    required String phone,
    required String password,
  }) async {
    try {
      final res = await client.postPublic(
        '/auth/login',
        data: {'phone': toE164(phone.trim()), 'password': password},
      );
      return await client.adoptSession(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) {
        throw const AuthException('Invalid phone number or password');
      }
      throw ApiException.fromDio(e);
    }
  }

  @override
  Future<void> logout() async {
    try {
      final refresh = client.refreshToken;
      if (refresh != null) {
        await client.postA('/auth/logout', data: {'refreshToken': refresh});
      }
    } catch (_) {
      // Server unreachable — local sign-out is still the honest outcome.
    }
    client.clearTokens();
    await tokenStore.clear();
  }
}

// ---------- DI ----------

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => Env.useMocks
      ? MockAuthRepository(ref.watch(tokenStoreProvider))
      : ApiAuthRepository(
          client: ref.watch(apiClientProvider),
          tokenStore: ref.watch(tokenStoreProvider),
        ),
);
