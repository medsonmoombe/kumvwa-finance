import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/router/app_router.dart';
import 'package:kumvwa_finance/core/theme/app_theme.dart';
import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/lender_invite_client_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_client_detail_screen.dart';

/// Restores an already-authenticated lender so the router redirect lets us
/// into the `/lender` tree without a sign-in dance.
class _LenderAuthRepository implements AuthRepository {
  @override
  Future<UserSession?> restoreSession() async => const UserSession(
    token: 'test-lender-jwt',
    userId: 'biz_001',
    displayName: 'Chilenje Community SACCO',
    phone: '0971234567',
    role: 'business',
  );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  // Regression guard: the Add-client icon on the clients screen pushes
  // `/lender/clients/new`. That path sits under the parameterised `:id`
  // route, so without an explicit `new` route go_router treated "new" as a
  // client id and opened the detail screen for a client called "new".
  testWidgets('tapping Add client lands on the invite screen', (tester) async {
    final container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(_LenderAuthRepository()),
        // Skip the brand hold so restore resolves promptly.
        splashHoldDurationProvider.overrideWithValue(Duration.zero),
        // The gate is borrower-only; keep it pending so no network is hit.
        clientGateProvider.overrideWith((ref) => Completer<ClientGateState>().future),
      ],
    );
    addTearDown(container.dispose);

    final router = container.read(appRouterProvider);
    addTearDown(router.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ),
    );

    // Let session restore resolve so the lender redirect no longer bounces us
    // back to the splash.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));

    router.go('/lender/clients/new');
    await tester.pumpAndSettle();

    expect(find.byType(LenderInviteClientScreen), findsOneWidget);
    expect(find.byType(LenderClientDetailScreen), findsNothing);
    expect(find.text('Add a client'), findsOneWidget);
  });
}
