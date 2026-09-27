import 'package:flutter/foundation.dart';

/// Build-time environment settings. All values can be overridden with
/// --dart-define when flavour/CI builds need a different backend.
class Env {
  Env._();

  static const appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'prod');

  static const _baseUrlOverride = String.fromEnvironment('API_BASE_URL');

  /// Opt out of the live backend entirely (offline demos / golden tests).
  /// `flutter run --dart-define=APP_USE_MOCKS=true` restores the old
  /// in-memory repositories.
  static const useMocks = bool.fromEnvironment('APP_USE_MOCKS');

  /// API base, including the `api/v1` prefix.
  ///
  /// Point your server's CORS + network config at the emulator loopback:
  /// Android emulators reach the host machine via 10.0.2.2 (NOT localhost —
  /// that's the emulator's own loopback). Every other platform can talk to
  /// localhost directly; `API_BASE_URL` always wins when provided.
  static String get apiBaseUrl {
    if (_baseUrlOverride.isNotEmpty) return _baseUrlOverride;
    // prod default — overridden at build time with
    //   --dart-define=API_BASE_URL=https://kumvwa-api.onrender.com/api/v1
    if (appEnv == 'prod') return 'https://kumvwa-api.onrender.com/api/v1';
    return defaultTargetPlatform == TargetPlatform.android
        ? 'http://10.0.2.2:8080/api/v1'
        : 'http://localhost:8080/api/v1';
  }

  static bool get isDev => appEnv == 'dev';

  static const connectTimeout = Duration(seconds: 60);
  static const receiveTimeout = Duration(seconds: 60);
}
