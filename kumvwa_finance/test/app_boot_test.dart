import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/app.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/splash_screen.dart';

void main() {
  const storageChannel = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );

  setUpAll(() {
    // Never hit the network for fonts in tests.
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  // Regression guard for the Phase 4 router dead-end: the splash is a
  // restoring-only waiting room. Once session restore resolves it must always
  // bounce somewhere — never sit there animating forever.
  testWidgets('splash always resolves — lands on Login when logged out', (
    tester,
  ) async {
    // No stored session: `read` returns null → logged out.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(storageChannel, (call) async => null);
    addTearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(storageChannel, null);
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // Skip the 1.8s brand hold — tests assert state transitions,
          // not the splash's on-screen duration.
          splashHoldDurationProvider.overrideWithValue(Duration.zero),
        ],
        child: const KumvwaApp(),
      ),
    );

    // Still restoring: the splash is the only legal destination.
    expect(find.byType(SplashScreen), findsOneWidget);

    // Let the async restore resolve, then let the router re-run its redirect.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    // Fail-safe: even if the platform read never answered, AuthController's
    // 6s timeout must still land us on Login rather than trapping the splash.
    await tester.pump(const Duration(seconds: 7));

    expect(find.byType(SplashScreen), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
