import 'dart:io';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';

/// Registers the FCM token with the backend. Fully guarded: without Firebase
/// config files this logs once and the app runs normally (in-app notifications
/// still work; push activates the moment google-services.json lands).
class PushService {
  PushService._();

  static bool _loggedMissing = false;

  /// [container] is the app's own graph (see main.dart) so the POST rides
  /// the same authenticated ApiClient the rest of the app uses.
  static Future<void> init(ProviderContainer container) async {
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp();
    } catch (_) {
      if (!_loggedMissing && kDebugMode) {
        _loggedMissing = true;
        debugPrint('PushService: Firebase not configured, push disabled (dev)');
      }
      return;
    }

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(provisional: true);

    final client = container.read(apiClientProvider);

    Future<void> register(String token) async {
      try {
        await client.postA(
          '/devices',
          data: {
            'token': token,
            'platform': Platform.isIOS ? 'ios' : 'android',
          },
        );
      } catch (_) {
        // Retried on next token refresh / app start.
      }
    }

    final token = await messaging.getToken();
    if (token != null) await register(token);
    messaging.onTokenRefresh.listen(register);
  }
}
