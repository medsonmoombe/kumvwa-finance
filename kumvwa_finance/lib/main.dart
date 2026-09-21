import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/app.dart';

void main() {
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

  runApp(const ProviderScope(child: KumvwaApp()));
}
