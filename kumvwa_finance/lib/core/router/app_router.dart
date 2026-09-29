import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/dev/loaders_preview_screen.dart';
import 'package:kumvwa_finance/core/widgets/client_shell.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/lender_register_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/login_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/lender_login_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/org_registration_success_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/role_select_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/splash_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_clients_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_client_detail_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_home_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_loan_detail_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_profile_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/screens/lender_requests_screen.dart';
import 'package:kumvwa_finance/features/lender/presentation/widgets/lender_shell.dart';
import 'package:kumvwa_finance/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:kumvwa_finance/features/notifications/presentation/screens/notification_detail_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/client_invite_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/invite_code_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_home_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_loan_detail_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_loan_history_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_request_loan_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/loan_request_detail_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/request_status_screen.dart';
import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';
import 'package:kumvwa_finance/features/onboarding/domain/registration_gate.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/profile_stepper_screen.dart';
import 'package:kumvwa_finance/features/profile/presentation/screens/client_profile_screen.dart';
import 'package:kumvwa_finance/features/profile/presentation/screens/complete_profile_screen.dart';

/// Client-only app. The lender surface lives in the web console; the mobile
/// reference implementation is preserved on the `lender-mobile-reference`
/// branch.
/// Where a borrower must land, given who they are and what they still owe.
///
/// Pure so the rules can be tested without standing up the router: [status]
/// and [needsProfile] come from the session, [registration] is the server's
/// gate — null while it is still loading, which is deliberately permissive.
String? appRedirect({
  required AuthStatus status,
  required bool needsProfile,
  required String location,
  required RegistrationDecision? registration,
  required String? role,
}) {
  if (location.startsWith('/dev')) return null;

  const preLogin = ['/splash', '/login', '/register', '/invite'];

  return switch (status) {
    AuthStatus.restoring => location == '/splash' ? null : '/splash',
    AuthStatus.unauthenticated =>
      preLogin.any(location.startsWith) ? null : '/splash',
    AuthStatus.authenticated => () {
      final isLender = role == 'business';

      // ── Lender routing ──────────────────────────────────────────────
      if (isLender) {
        // Allow success screen (pre-session) and lender shell.
        if (location.startsWith('/lender') ||
            location == '/register/lender/success') {
          return null;
        }
        return '/lender/home';
      }

      // ── Borrower routing ────────────────────────────────────────────
      if (location.startsWith('/c/register') &&
          (registration?.owesThenRegisters ?? false)) {
        return '/c/home';
      }

      if (needsProfile) {
        final clearingLoan = registration?.owesThenRegisters ?? false;
        final allowedWhileIncomplete = clearingLoan
            ? [
                '/c/complete-profile',
                '/c/profile',
                '/c/home',
                '/c/loan/',
                '/c/history',
                '/c/alerts',
                '/invite',
              ]
            : ['/c/complete-profile', '/c/register', '/c/profile', '/invite'];
        return allowedWhileIncomplete.any(location.startsWith)
            ? null
            : '/c/complete-profile';
      }
      return location.startsWith('/c') || location.startsWith('/invite')
          ? null
          : '/c/home';
    }(),
  };
}

final appRouterProvider = Provider<GoRouter>((ref) {
  // Bump this notifier whenever auth state changes so go_router
  // re-evaluates redirects.
  final refresh = ValueNotifier(0);
  ref.listen(authControllerProvider, (_, _) => refresh.value++);
  // The registration gate is fetched asynchronously, so a redirect that runs
  // before it resolves would otherwise see "unknown" and lock the borrower out
  // of the pay surface. Re-run the redirects the moment it lands.
  ref.listen(clientGateProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      return appRedirect(
        status: auth.status,
        needsProfile: auth.session?.needsProfile ?? false,
        location: state.matchedLocation,
        registration: ref.read(clientGateProvider).valueOrNull?.registration,
        role: auth.session?.role,
      );
    },
    routes: [
      GoRoute(
        path: '/splash',
        name: 'splash',
        builder: (_, _) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        name: 'login',
        builder: (_, _) => const LoginScreen(),
      ),
      GoRoute(
        path: '/login/lender',
        name: 'lender-login',
        builder: (_, _) => const LenderLoginScreen(),
      ),
      GoRoute(
        path: '/register/client',
        name: 'register-client',
        builder: (_, _) => const RoleSelectScreen(),
      ),
      GoRoute(
        path: '/register/client/borrower',
        name: 'register-borrower',
        builder: (_, _) => const InviteCodeScreen(),
      ),
      GoRoute(
        path: '/register/lender',
        name: 'register-lender',
        builder: (_, _) => const LenderRegisterScreen(),
      ),
      GoRoute(
        path: '/register/lender/success',
        name: 'register-lender-success',
        builder: (_, state) => OrgRegistrationSuccessScreen(
          businessName: state.extra as String? ?? 'Your Organisation',
        ),
      ),

      // ── Lender shell ──────────────────────────────────────────────────────
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => LenderShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/lender/home',
                name: 'lender-home',
                builder: (_, _) => const LenderHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/lender/clients',
                name: 'lender-clients',
                builder: (_, _) => const LenderClientsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    name: 'lender-client-detail',
                    builder: (_, state) => LenderClientDetailScreen(clientId: state.pathParameters['id']!),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/lender/requests',
                name: 'lender-requests',
                builder: (_, _) => const LenderRequestsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/lender/alerts',
                name: 'lender-alerts',
                builder: (_, _) => const NotificationsScreen(
                  role: 'lender',
                  embedded: true,
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/lender/profile',
                name: 'lender-profile',
                builder: (_, _) => const LenderProfileScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: '/invite/:token',
        name: 'client-invite',
        builder: (_, state) =>
            ClientInviteScreen(code: state.pathParameters['token']!),
      ),
      GoRoute(
        path: '/lender/loans/:id',
        name: 'lender-loan-detail',
        builder: (_, state) => LenderLoanDetailScreen(loanId: state.pathParameters['id']!),
      ),
      // Dev-only: never registered in release, so the loaders preview
      // cannot ship.
      if (Env.isDev)
        GoRoute(
          path: '/dev/loaders',
          name: 'dev-loaders',
          builder: (_, _) => const LoadersPreviewScreen(),
        ),

      // ---------- client loan detail (full-screen push) ----------
      GoRoute(
        path: '/c/loan/:id',
        name: 'client-loan-detail',
        builder: (_, state) =>
            ClientLoanDetailScreen(loanId: state.pathParameters['id']!),
      ),

      // ---------- client loan request form ----------
      GoRoute(
        path: '/c/request',
        name: 'client-request-loan',
        builder: (_, _) => const ClientRequestLoanScreen(),
      ),

      // ---------- client loan request detail (read-only for borrower) ----------
      GoRoute(
        path: '/c/request/:id',
        name: 'client-request-detail',
        builder: (_, state) =>
            LoanRequestDetailScreen(requestId: state.pathParameters['id']!),
      ),

      // ---------- client loan request status (full-screen push) ----------
      GoRoute(
        path: '/c/request-status/:id',
        name: 'client-request-status',
        builder: (_, state) =>
            RequestStatusScreen(requestId: state.pathParameters['id']!),
      ),

      GoRoute(
        path: '/c/notification/:id',
        name: 'client-notification-detail',
        builder: (_, state) => NotificationDetailScreen(
          notification: state.extra as AppNotification?,
        ),
      ),

      // ---------- post-login KYC wizard (borrower) ----------
      // Root-level so there is no bottom-nav shell while the profile is
      // incomplete; it redirects the borrower home once they reach 100%.
      GoRoute(
        path: '/c/complete-profile',
        name: 'client-complete-profile',
        builder: (_, _) => const CompleteProfileScreen(),
      ),

      // ---------- registration stepper (borrower) ----------
      // Normally rendered in place of the home body, so it needs no route. It
      // is reachable as one for the borrower who may clear a loan first but
      // still owes the stepper its required fields.
      GoRoute(
        path: '/c/register',
        name: 'client-register',
        builder: (_, _) => const ProfileStepperScreen(),
      ),

      // ---------- client shell (borrower bottom-nav tabs) ----------
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => ClientShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/c/home',
                name: 'client-home',
                builder: (_, _) => const ClientHomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/c/history',
                name: 'client-history',
                builder: (_, _) => const ClientLoanHistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/c/alerts',
                name: 'client-alerts',
                builder: (_, _) =>
                    const NotificationsScreen(role: 'client', embedded: true),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/c/profile',
                name: 'client-profile',
                builder: (_, _) => const ClientProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
