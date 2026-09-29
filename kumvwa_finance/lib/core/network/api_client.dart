import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
import 'package:kumvwa_finance/core/storage/token_store.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';

/// Bumped whenever background token refresh fails while a user is signed in.
/// `AuthController` listens and logs the user out — otherwise an expired
/// session would leave the router stuck in a phantom authenticated state.
final sessionExpiryStampProvider = StateProvider<int>((ref) => 0);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    tokenStore: TokenStore(),
    onSessionExpired: () {
      try {
        ref.read(sessionExpiryStampProvider.notifier).state++;
      } catch (_) {
        // Provider unmounted (app teardown) — nothing to notify.
      }
    },
  );
});

/// Single HTTP front door for every API-backed repository.
///
/// Wraps two Dio instances:
///  * `_bare` — no auth, used for login + token refresh only.
///  * `_dio`  — injects the bearer token and transparently refreshes a
///    single flight of concurrent 401s, then replays the original request.
///  * Tokens persist via [TokenStore] (secure storage), so an app restart
///    restores the session without re-entering credentials.
class ApiClient {
  ApiClient({required this.tokenStore, required this.onSessionExpired}) {
    final base = BaseOptions(
      baseUrl: Env.apiBaseUrl,
      connectTimeout: Env.connectTimeout,
      receiveTimeout: Env.receiveTimeout,
      headers: {'X-Client': 'mobile'},
    );

    _bare = Dio(base);
    _dio = Dio(base)
      ..interceptors.add(
        InterceptorsWrapper(onRequest: _attachToken, onError: _onError),
      );
  }

  late final Dio _bare;
  late final Dio _dio;
  final TokenStore tokenStore;
  final VoidCallback onSessionExpired;

  String? _access;
  String? _refresh;
  Future<bool>? _refreshInFlight;
  bool _lastRefreshWasAuthRejected = false;

  String? get accessToken => _access;
  String? get refreshToken => _refresh;
  bool get lastRefreshWasAuthRejected => _lastRefreshWasAuthRejected;

  void _attachToken(RequestOptions options, RequestInterceptorHandler handler) {
    final access = _access;
    if (access != null && !options.path.contains('/auth/refresh')) {
      options.headers['Authorization'] = 'Bearer $access';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final status = error.response?.statusCode;
    final isAuthRoute = error.requestOptions.path.contains('/auth/');
    final canRefresh =
        status == 401 &&
        !isAuthRoute &&
        _access != null &&
        _refresh != null &&
        error.requestOptions.extra['refreshed'] != true;

    if (!canRefresh) {
      handler.next(error);
      return;
    }

    final refreshed = await _refreshTokens();
    if (!refreshed) {
      handler.next(error);
      return;
    }

    final request = error.requestOptions;
    final clone = await _dio.request<dynamic>(
      request.path,
      data: request.data,
      queryParameters: request.queryParameters,
      options: Options(
        method: request.method,
        extra: {...request.extra, 'refreshed': true},
      ),
    );
    handler.resolve(clone);
  }

  /// Single-flight refresh: concurrent 401s share one `/auth/refresh` call.
  Future<bool> _refreshTokens() {
    final inFlight = _refreshInFlight;
    if (inFlight != null) return inFlight;
    final future = _doRefresh();
    _refreshInFlight = future;
    future.whenComplete(() => _refreshInFlight = null);
    return future;
  }

  Future<bool> _doRefresh() async {
    final refresh = _refresh;
    if (refresh == null) return false;
    _lastRefreshWasAuthRejected = false;
    try {
      final res = await _bare.post<dynamic>(
        '/auth/refresh',
        data: {'refreshToken': refresh},
      );
      final data = res.data as Map<String, dynamic>;
      final access = data['accessToken'] as String?;
      if (access == null) return false;
      setTokens(access, data['refreshToken'] as String?);
      await _persistSession(data);
      return true;
    } on DioException catch (error) {
      // Only an explicit auth rejection invalidates a persisted session.
      // A timeout, offline connection, or 5xx during app startup must not
      // throw a user out of the app merely because the network blinked.
      final status = error.response?.statusCode;
      if (status == 401 || status == 403) {
        _lastRefreshWasAuthRejected = true;
        clearTokens();
        await tokenStore.clear();
        onSessionExpired();
      }
      return false;
    } catch (_) {
      // Keep the stored session for transient non-HTTP failures too.
      return false;
    }
  }

  Future<void> _persistSession(Map<String, dynamic> data) async {
    final user = data['user'];
    if (user is! Map<String, dynamic>) return;
    await tokenStore.saveSession(
      _sessionFrom(
        user,
        data['accessToken'] as String?,
        data['refreshToken'] as String?,
      ),
    );
  }

  /// Adapts a login/refresh payload into a session, persists it, and makes
  /// the tokens live for all future requests.
  Future<UserSession> adoptSession(Map<String, dynamic> data) async {
    final user = data['user'] as Map<String, dynamic>? ?? data;
    final access = data['accessToken'] as String? ?? '';
    final refresh = data['refreshToken'] as String?;
    final session = _sessionFrom(user, access, refresh);
    setTokens(access, refresh);
    await tokenStore.saveSession(session);
    return session;
  }

  /// Console-style token responses deliberately omit the user projection.
  /// Mobile lender sign-in fetches it once after email OTP succeeds.
  Future<UserSession> adoptTokensAndFetchUser(Map<String, dynamic> data) async {
    final access = data['accessToken'] as String?;
    if (access == null || access.isEmpty) throw StateError('Missing access token');
    setTokens(access, data['refreshToken'] as String?);
    final me = await getA('/auth/me');
    final session = _sessionFrom(
      me.data as Map<String, dynamic>,
      access,
      data['refreshToken'] as String?,
    );
    await tokenStore.saveSession(session);
    return session;
  }

  UserSession _sessionFrom(
    Map<String, dynamic> user,
    String? access,
    String? refresh,
  ) {
    return UserSession(
      token: access ?? '',
      userId: user['userId'] as String? ?? '',
      displayName: user['displayName'] as String? ?? '',
      phone: user['phone'] as String? ?? '',
      role: toAppRole(user['role'] as String? ?? 'client'),
      refreshToken: refresh,
      profileComplete: user['profileComplete'] as bool? ?? true,
      profilePercent: user['profilePercent'] as int? ?? 100,
    );
  }

  /// Loads any persisted session from secure storage, making its tokens live.
  /// Returns the access token, or null when logged out. No network I/O.
  Future<String?> restoreTokens() async {
    final session = await tokenStore.readSession();
    if (session == null) {
      _access = null;
      _refresh = null;
      return null;
    }
    _access = session.token;
    _refresh = session.refreshToken;
    return session.token;
  }

  void setTokens(String? access, String? refresh) {
    _access = access;
    _refresh = refresh;
  }

  void clearTokens() {
    _access = null;
    _refresh = null;
  }

  // ---- authenticated helpers (repos call these) ----

  Future<Response<dynamic>> getA(String path, {Map<String, dynamic>? query}) =>
      _dio.get(path, queryParameters: query);

  Future<Response<dynamic>> postA(
    String path, {
    Object? data,
    Map<String, dynamic>? headers,
  }) => _dio.post(
    path,
    data: data,
    options: Options(headers: headers),
  );

  Future<Response<dynamic>> patchA(String path, {Object? data}) =>
      _dio.patch(path, data: data);

  Future<Response<dynamic>> putA(String path, {Object? data}) =>
      _dio.put(path, data: data);

  // ---- public endpoints (no bearer) ----

  Future<Response<dynamic>> postPublic(
    String path, {
    Object? data,
    Map<String, dynamic>? headers,
  }) => _bare.post(path, data: data, options: Options(headers: headers));

  Future<Response<dynamic>> getPublic(String path) => _bare.get(path);
}
