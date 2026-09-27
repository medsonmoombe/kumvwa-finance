import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/app.dart';
import 'package:kumvwa_finance/core/network/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // One container owned by main so pre-app work (push registration) shares
  // the same provider graph — and the same authenticated ApiClient — as the
  // widget tree.
  final container = ProviderContainer();

  // FCM device registration — fully guarded no-op without Firebase config.
  await PushService.init(container);

  // Errors caught by Flutter framework (widget build errors, etc.)
  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    // TODO: send to crash reporting (Sentry/Firebase Crashlytics) later
    debugPrint('FATAL(flutter): ${details.exception}');
  };

  // Errors outside Flutter (platform channels, async zones)
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('FATAL(platform): $error');
    return true;
  };

  runApp(
    UncontrolledProviderScope(container: container, child: const KumvwaApp()),
  );
}
