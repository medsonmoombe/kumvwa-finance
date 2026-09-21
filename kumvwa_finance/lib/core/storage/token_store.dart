import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'package:kumvwa_finance/features/auth/domain/user_session.dart';

/// Encrypted on-disk session storage (Android Keystore / iOS Keychain).
/// Never store auth tokens in plain SharedPreferences.
class TokenStore {
  static const _key = 'kumvwa_session';
  final _storage = const FlutterSecureStorage();

  Future<void> saveSession(UserSession session) =>
      _storage.write(key: _key, value: jsonEncode(session.toJson()));

  Future<UserSession?> readSession() async {
    String? raw;
    try {
      raw = await _storage.read(key: _key);
    } catch (e) {
      // Keystore / platform failure — treat as logged out rather than
      // bubbling an exception that would leave the app on the splash.
      debugPrint('TokenStore.read failed: $e');
      return null;
    }
    if (raw == null) return null;
    try {
      return UserSession.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null; // corrupted entry — treat as logged out
    }
  }

  Future<void> clear() => _storage.delete(key: _key);
}
