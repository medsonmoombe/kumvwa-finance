import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/router/app_router.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/onboarding/domain/registration_gate.dart';

RegistrationDecision _decision(RegistrationGateAction action) =>
    RegistrationDecision(
      action: action,
      missing: action == RegistrationGateAction.complete
          ? const []
          : const [RegistrationField.kinPhone],
      openLoanCount: action == RegistrationGateAction.clearLoanFirst ? 1 : 0,
      openTotalOutstanding: action == RegistrationGateAction.clearLoanFirst
          ? 800
          : 0,
    );

/// Shorthand for the authenticated borrower, who is the app's only audience.
String? _go(
  String location, {
  required RegistrationGateAction action,
  bool kycComplete = true,
  RegistrationDecision? override,
}) => appRedirect(
  status: AuthStatus.authenticated,
  needsProfile: !kycComplete,
  location: location,
  registration: override ?? _decision(action),
  role: 'client',
);

void main() {
  group('appRedirect — auth states', () {
    test('restoring can only sit on the splash', () {
      expect(
        appRedirect(
          status: AuthStatus.restoring,
          needsProfile: false,
          location: '/splash',
          registration: null,
          role: null,
        ),
        isNull,
      );
      expect(
        appRedirect(
          status: AuthStatus.restoring,
          needsProfile: false,
          location: '/c/home',
          registration: null,
          role: null,
        ),
        '/splash',
      );
    });

    test('logged out, only login/register/invite are reachable', () {
      for (final path in ['/login', '/register', '/invite', '/invite/abc']) {
        expect(
          appRedirect(
            status: AuthStatus.unauthenticated,
            needsProfile: false,
            location: path,
            registration: null,
            role: null,
          ),
          isNull,
          reason: path,
        );
      }
      expect(
        appRedirect(
          status: AuthStatus.unauthenticated,
          needsProfile: false,
          location: '/c/home',
          registration: null,
          role: null,
        ),
        '/login',
      );
    });

    test('dev previews stay reachable in every auth state', () {
      for (final status in AuthStatus.values) {
        expect(
          appRedirect(
            status: status,
            needsProfile: true,
            location: '/dev',
            registration: _decision(RegistrationGateAction.clearLoanFirst),
            role: null,
          ),
          isNull,
          reason: '$status',
        );
      }
    });

    test('a logged-in borrower is pushed into the client tree', () {
      expect(
        _go('/lender/dashboard', action: RegistrationGateAction.complete),
        isNull, // lender routes are handled by lender redirect, not this helper
      );
      expect(_go('/c/home', action: RegistrationGateAction.complete), isNull);
    });
  });

  group('appRedirect — registration gate', () {
    test('a fully registered borrower reaches the stepper', () {
      expect(
        _go('/c/register', action: RegistrationGateAction.complete),
        isNull,
      );
    });

    test('missing fields with no debt bind them to the stepper', () {
      expect(
        _go('/c/register', action: RegistrationGateAction.completeRegistration),
        isNull,
      );
    });

    test('an unpaid loan keeps the borrower out of the stepper', () {
      expect(
        _go('/c/register', action: RegistrationGateAction.clearLoanFirst),
        '/c/home',
        reason: 'the balance must clear before registration binds',
      );
    });

    test('an unpaid loan still leaves the rest of the app open', () {
      for (final path in ['/c/home', '/c/loan/loan-1', '/c/history']) {
        expect(
          _go(path, action: RegistrationGateAction.clearLoanFirst),
          isNull,
          reason: path,
        );
      }
    });
  });

  group('appRedirect — debt clearance outranks the KYC wizard', () {
    test('a KYC-incomplete borrower in debt can reach the pay surface', () {
      for (final path in [
        '/c/home',
        '/c/loan/loan-1',
        '/c/history',
        '/c/alerts',
        '/c/complete-profile',
      ]) {
        expect(
          _go(
            path,
            action: RegistrationGateAction.clearLoanFirst,
            kycComplete: false,
          ),
          isNull,
          reason: path,
        );
      }
    });

    test('...but still cannot reach the stepper', () {
      expect(
        _go(
          '/c/register',
          action: RegistrationGateAction.clearLoanFirst,
          kycComplete: false,
        ),
        '/c/home',
      );
    });

    test('a KYC-incomplete borrower with no debt is held at the wizard', () {
      expect(
        _go(
          '/c/loan/loan-1',
          action: RegistrationGateAction.completeRegistration,
          kycComplete: false,
        ),
        '/c/complete-profile',
      );
    });
  });

  group('appRedirect — the gate has not loaded yet', () {
    test('the stepper is not blocked while the gate is unknown', () {
      expect(
        appRedirect(
          status: AuthStatus.authenticated,
          needsProfile: false,
          location: '/c/register',
          registration: null,
          role: 'client',
        ),
        isNull,
        reason: 'stay permissive; the router re-runs this once the gate lands',
      );
    });
  });
}
