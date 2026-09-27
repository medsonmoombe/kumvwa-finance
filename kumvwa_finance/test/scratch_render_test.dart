import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_theme.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_home_screen.dart';
import 'package:kumvwa_finance/features/notifications/data/notifications_repository.dart';
import 'package:kumvwa_finance/features/onboarding/domain/registration_gate.dart';

class _Authed extends AuthController {
  @override
  AuthState build() => const AuthState.authenticated(
    UserSession(
      token: 't',
      userId: 'clt_001',
      displayName: 'Mwansa Bwalya',
      phone: '0971112233',
      role: 'client',
      profileComplete: true,
      profilePercent: 100,
    ),
  );
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Future<void> pumpHome(
    WidgetTester tester, {
    RegistrationDecision registration = const RegistrationDecision(
      action: RegistrationGateAction.complete,
    ),
  }) async {
    await tester.binding.setSurfaceSize(const Size(666.7, 2400));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_Authed.new),
          loansRepositoryProvider.overrideWithValue(mockLoansRepository),
          loanRequestsRepositoryProvider
              .overrideWithValue(mockLoanRequestsRepository),
          notificationsRepositoryProvider
              .overrideWithValue(MockNotificationsRepository()),
          clientMeProvider.overrideWith(
            (ref) async => clientProfileFromJson(const {
              'fullName': 'Mwansa Bwalya',
              'phone': '0971112233',
              'profilePercent': 100,
              'profileComplete': true,
            }),
          ),
          clientGateProvider.overrideWith(
            (ref) async => ClientGateState(
              profileCompleted: true,
              registration: registration,
              termsVersion: 1,
              termsBody: 'Platform terms body.',
              termsAccepted: true,
              lenders: const [
                LenderStatus(
                  tenantId: 'biz_001',
                  name: 'Chilenje Community SACCO',
                  primaryColor: '#1A4FBF',
                  termsVersion: 2,
                  termsAccepted: false,
                ),
              ],
            ),
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const ClientHomeScreen(),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
  }

  testWidgets('API-mode home renders clean with terms-pending lender', (
    tester,
  ) async {
    await pumpHome(tester);
    expect(
      find.text('Chilenje Community SACCO updated their terms'),
      findsOneWidget,
    );
  });

  testWidgets('missing registration binds the borrower to the stepper', (
    tester,
  ) async {
    await pumpHome(
      tester,
      registration: const RegistrationDecision(
        action: RegistrationGateAction.completeRegistration,
        missing: [RegistrationField.kinPhone],
      ),
    );
    // The stepper replaces the home body outright.
    expect(find.text('Complete your profile'), findsOneWidget);
    expect(find.text('Employment status'), findsOneWidget);
    expect(find.text('Finish your registration'), findsNothing);
  });

  testWidgets('an unpaid loan keeps the borrower in the app to clear it', (
    tester,
  ) async {
    await pumpHome(
      tester,
      registration: const RegistrationDecision(
        action: RegistrationGateAction.clearLoanFirst,
        missing: [RegistrationField.kinName, RegistrationField.kinPhone],
        openLoanCount: 1,
        openTotalOutstanding: 800,
      ),
    );
    // Home renders (the pay surface is reachable) with the stepper queued as a
    // card that names exactly what is still outstanding — and it stays locked
    // until the balance clears.
    expect(find.text('Finish your registration'), findsOneWidget);
    expect(
      find.text(
        'Clear your balance of K800.00 first, then: Next of kin name, '
        'Next of kin phone.',
      ),
      findsOneWidget,
    );
    expect(find.text('Complete your profile'), findsNothing);
    expect(find.byIcon(Icons.lock_clock_outlined), findsOneWidget);
  });
}