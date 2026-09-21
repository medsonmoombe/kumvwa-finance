import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/dev/loaders_preview_screen.dart';
import 'package:kumvwa_finance/core/widgets/app_shell.dart';
import 'package:kumvwa_finance/core/widgets/client_shell.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/business_registration_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/login_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/splash_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/verification_pending_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/add_client_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/client_detail_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/client_invite_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/clients_screen.dart';
import 'package:kumvwa_finance/features/clients/presentation/screens/invite_code_screen.dart';
import 'package:kumvwa_finance/features/dashboard/presentation/screens/home_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_home_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_loan_detail_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/client_request_loan_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/loan_detail_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/loan_request_detail_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/loan_requests_screen.dart';
import 'package:kumvwa_finance/features/loans/presentation/screens/loans_screen.dart';
import 'package:kumvwa_finance/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/onboarding_screen.dart';
import 'package:kumvwa_finance/features/profile/presentation/screens/client_profile_screen.dart';
import 'package:kumvwa_finance/features/profile/presentation/screens/profile_screen.dart';
import 'package:kumvwa_finance/features/reports/presentation/screens/reports_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  // Bump this notifier whenever auth state changes so go_router
  // re-evaluates redirects.
  final refresh = ValueNotifier(0);
  ref.listen(authControllerProvider, (_, _) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      // Dev-only previews stay reachable in every auth state.
      if (loc.startsWith('/dev')) return null;

      // Routes reachable while logged OUT. Invites are reachable in BOTH
      // states: a borrower opens the link logged out, and a lender may want
      // to preview the link they just created.
      const preLogin = ['/login', '/onboarding', '/register', '/invite'];

      return switch (auth.status) {
        // Still restoring: the splash is the only legal destination.
        AuthStatus.restoring => loc == '/splash' ? null : '/splash',
        // NOTE: '/splash' is deliberately NOT whitelisted here. If it were,
        // the app would dead-end on the splash forever once restore finishes.
        AuthStatus.unauthenticated =>
          preLogin.any(loc.startsWith) ? null : '/login',
        AuthStatus.authenticated => () {
            final role = auth.session?.role;
            final isClientArea = loc.startsWith('/c');
            final isBusinessArea = [
              '/home',
              '/clients',
              '/loans',
              '/requests',
              '/reports',
              '/profile',
              '/notifications',
            ].any(loc.startsWith);
            final shared =
                loc.startsWith('/invite') || loc.startsWith('/dev');

            if (role == 'client') {
              return (isClientArea || shared) ? null : '/c/home';
            }
            return (isBusinessArea || shared) ? null : '/home';
          }(),
      };
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
        path: '/onboarding',
        name: 'onboarding',
        builder: (_, _) => const OnboardingScreen(),
      ),
      GoRoute(
        path: '/register/business',
        name: 'register-business',
        builder: (_, _) => const BusinessRegistrationScreen(),
        routes: [
          GoRoute(
            path: 'pending',
            name: 'register-business-pending',
            builder: (_, _) => const VerificationPendingScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/register/client',
        name: 'register-client',
        builder: (_, _) => const InviteCodeScreen(),
      ),
      GoRoute(
        path: '/invite/:token',
        name: 'client-invite',
        builder: (_, state) =>
            ClientInviteScreen(token: state.pathParameters['token']!),
      ),
      // Dev-only: never registered in release, so the loaders preview
      // cannot ship.
      if (Env.isDev)
        GoRoute(
          path: '/dev/loaders',
          name: 'dev-loaders',
          builder: (_, _) => const LoadersPreviewScreen(),
        ),
      // Deliberately a ROOT-level route, not nested in the Clients branch:
      // go_router injects a branch-nested route into that branch, so popping
      // would land on the Clients tab. Root-level keeps Add Client a
      // full-screen form that returns to whichever tab pushed it.
      GoRoute(
        path: '/clients/add',
        name: 'add-client',
        builder: (_, _) => const AddClientScreen(),
      ),

      // ---------- business notification center ----------
      GoRoute(
        path: '/notifications',
        name: 'notifications',
        builder: (_, _) => const NotificationsScreen(role: 'business'),
      ),

      // ---------- loan requests (lender side) ----------
      GoRoute(
        path: '/requests',
        name: 'loan-requests',
        builder: (_, _) => const LoanRequestsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            name: 'loan-request-detail',
            builder: (_, state) => LoanRequestDetailScreen(
              requestId: state.pathParameters['id']!,
            ),
          ),
        ],
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

      // ---------- app shell (bottom-nav tabs) ----------
      // Each branch keeps its own navigator, so switching tabs preserves
      // scroll position and in-progress state.
      StatefulShellRoute.indexedStack(
        builder: (_, _, shell) => AppShell(shell: shell),
        branches: [
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/home',
                name: 'home',
                builder: (_, _) => const HomeScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/clients',
                name: 'clients',
                builder: (_, _) => const ClientsScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    name: 'client-detail',
                    builder: (_, state) => ClientDetailScreen(
                      clientId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/loans',
                name: 'loans',
                builder: (_, _) => const LoansScreen(),
                routes: [
                  GoRoute(
                    path: ':id',
                    name: 'loan-detail',
                    builder: (_, state) => LoanDetailScreen(
                      loanId: state.pathParameters['id']!,
                    ),
                  ),
                ],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/reports',
                name: 'reports',
                builder: (_, _) => const ReportsScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: '/profile',
                name: 'profile',
                builder: (_, _) => const ProfileScreen(),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
