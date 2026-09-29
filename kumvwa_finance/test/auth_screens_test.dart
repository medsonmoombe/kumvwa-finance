import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl_phone_field/intl_phone_field.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_card.dart';
import 'package:kumvwa_finance/core/widgets/app_field.dart';
import 'package:kumvwa_finance/core/widgets/app_phone_field.dart';
import 'package:kumvwa_finance/core/widgets/brand_tile.dart';
import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/login_screen.dart';
import 'package:kumvwa_finance/features/auth/presentation/screens/splash_screen.dart';

/// Screen-level guards for the two screens the design system was proven on.
///
/// The foundation has its own geometry tests; what these cover is the wiring:
/// that the screen actually uses the new components, that validation still
/// blocks a submit, and that neither screen overflows on the narrowest phone the
/// app supports. `flutter test` substitutes a font whose glyphs are all a full
/// em square, so text here measures ~1.7x its real width — anything that fits
/// here has real slack on a device.
class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.onLogin});

  final Future<UserSession> Function(String phone, String password)? onLogin;
  final List<({String phone, String password})> calls = [];

  @override
  Future<UserSession> login({required String phone, required String password}) {
    calls.add((phone: phone, password: password));
    return onLogin?.call(phone, password) ??
        Future<UserSession>.error(const AuthException('nope'));
  }

  @override
  Future<UserSession?> restoreSession() async => null;

  @override
  Future<LenderSignInResult> loginLender({required String email, required String password}) =>
      Future<LenderSignInResult>.error(const AuthException('nope'));

  @override
  Future<UserSession> verifyLenderOtp({required String preToken, required String code}) =>
      Future<UserSession>.error(const AuthException('nope'));

  @override
  Future<UserSession> redeemLenderAccessCode(String code) =>
      Future<UserSession>.error(const AuthException('nope'));

  @override
  Future<void> logout() async {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  Future<void> pumpAt(
    WidgetTester tester,
    Widget child, {
    Size size = const Size(360, 720),
    AuthRepository? repo,
    List<Override> extra = const [],
    void Function(GoRouter)? onRouter,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(path: '/', builder: (_, _) => child),
        GoRoute(
          path: '/register/client',
          builder: (_, _) => const Scaffold(body: Text('INVITE_ROUTE')),
        ),
      ],
    );
    addTearDown(router.dispose);
    onRouter?.call(router);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          splashHoldDurationProvider.overrideWithValue(Duration.zero),
          // Always stub the repository. The real one reaches for secure storage
          // and the network, which leaves a pending timer at teardown and turns
          // every assertion in this file into a lie about the UI.
          authRepositoryProvider.overrideWithValue(
            repo ?? _FakeAuthRepository(),
          ),
          ...extra,
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();
  }

  group('SplashScreen', () {
    testWidgets('shows the brand lockup, tagline and a spinner', (
      tester,
    ) async {
      await pumpAt(tester, const SplashScreen());

      expect(find.byType(BrandLockup), findsOneWidget);
      expect(find.text('Kumvwa'), findsOneWidget);
      expect(find.text('FINANCE'), findsOneWidget);
      expect(find.text('Your vehicle. Your freedom.'), findsOneWidget);
      expect(find.byType(AppSpinner), findsOneWidget);
    });

    testWidgets('does not overflow on the narrowest phone', (tester) async {
      await pumpAt(tester, const SplashScreen(), size: const Size(320, 568));
      expect(tester.takeException(), isNull);
    });

    testWidgets('stays a launch screen — nothing on it is tappable', (
      tester,
    ) async {
      await pumpAt(tester, const SplashScreen());
      // A marketing CTA here would be unreachable: the router redirects as soon
      // as session restore resolves, usually in well under a second.
      expect(find.byType(AppButton), findsNothing);
      expect(
        find.byType(GestureDetector),
        findsNothing,
        reason: 'the splash must not present an action it cannot wait for',
      );
    });
  });

  group('LoginScreen', () {
    testWidgets('renders the two fields in the new style', (tester) async {
      await pumpAt(tester, const LoginScreen());

      // The phone field keeps its own widget so it can carry the locked
      // +260 prefix; the password is a plain field.
      expect(find.byType(AppPhoneField), findsOneWidget);
      expect(find.byType(AppField), findsOneWidget);
      expect(find.text('Phone number'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
      expect(find.byType(BrandLockup), findsOneWidget);
      expect(find.text('Welcome back'), findsOneWidget);
      // The API authenticates by phone, so the field must ask for one — and
      // the country must be Zambia, locked, with no picker to wander into.
      final phone = tester.widget<AppPhoneField>(find.byType(AppPhoneField));
      expect(phone.controller.text, isEmpty);
      final intl = tester.widget<IntlPhoneField>(find.byType(IntlPhoneField));
      expect(intl.initialCountryCode, 'ZM');
      expect(intl.showDropdownIcon, isFalse);
    });

    testWidgets('blocks an empty submit and names both fields', (tester) async {
      final repo = _FakeAuthRepository();
      await pumpAt(tester, const LoginScreen(), repo: repo);

      await tester.tap(find.text('Log In'));
      await tester.pumpAndSettle();

      expect(find.text('Phone number is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
      expect(
        repo.calls,
        isEmpty,
        reason: 'an invalid form must not hit the API',
      );
    });

    testWidgets('submits the phone and password it was given', (tester) async {
      final repo = _FakeAuthRepository();
      await pumpAt(tester, const LoginScreen(), repo: repo);

      await tester.enterText(find.byType(TextField).at(0), '971234567');
      await tester.enterText(find.byType(TextField).at(1), 'kumvwa123');
      await tester.tap(find.text('Log In'));
      await tester.pumpAndSettle();

      expect(repo.calls.single.phone, '971234567');
      expect(repo.calls.single.password, 'kumvwa123');
    });

    testWidgets('surfaces a rejected sign-in in a notice, not a snackbar', (
      tester,
    ) async {
      final repo = _FakeAuthRepository(
        onLogin: (_, _) =>
            Future<UserSession>.error(const AuthException('Bad')),
      );
      await pumpAt(tester, const LoginScreen(), repo: repo);

      await tester.enterText(find.byType(TextField).at(0), '971234567');
      await tester.enterText(find.byType(TextField).at(1), 'kumvwa123');
      await tester.tap(find.text('Log In'));
      await tester.pumpAndSettle();

      expect(find.text('Could not sign in'), findsOneWidget);
      expect(find.text('Bad'), findsOneWidget);
      // The point of the test: the failure lands in the layout, not in a
      // transient snackbar that would be gone before a user read it.
      expect(find.byType(NoticeBanner), findsOneWidget);
      expect(find.byType(SnackBar), findsNothing);
    });

    testWidgets('locks the fields and spins while submitting', (tester) async {
      final gate = Completer<UserSession>();
      final repo = _FakeAuthRepository(onLogin: (_, _) => gate.future);
      await pumpAt(tester, const LoginScreen(), repo: repo);

      await tester.enterText(find.byType(TextField).at(0), '971234567');
      await tester.enterText(find.byType(TextField).at(1), 'kumvwa123');
      await tester.tap(find.text('Log In'));
      await tester.pump();

      expect(find.byType(AppSpinner), findsOneWidget);
      final fields = tester.widgetList<AppField>(find.byType(AppField));
      expect(fields.every((f) => f.enabled), isFalse);

      gate.completeError(const AuthException('done'));
      await tester.pumpAndSettle();
    });

    testWidgets('hides the password behind an eye the user controls', (
      tester,
    ) async {
      await pumpAt(tester, const LoginScreen());

      expect(
        tester.widget<TextField>(find.byType(TextField).at(1)).obscureText,
        isTrue,
      );
      await tester.tap(find.byIcon(Icons.visibility_outlined));
      await tester.pump();
      expect(
        tester.widget<TextField>(find.byType(TextField).at(1)).obscureText,
        isFalse,
      );
    });

    testWidgets('routes a new borrower to the invite-code flow', (
      tester,
    ) async {
      await pumpAt(tester, const LoginScreen());

      await tester.tap(find.text('Enter an invite code'));
      await tester.pumpAndSettle();
      expect(find.text('INVITE_ROUTE'), findsOneWidget);
    });

    testWidgets('only prints credentials in a dev build', (tester) async {
      await pumpAt(tester, const LoginScreen(), size: const Size(360, 1000));
      if (Env.isDev && Env.useMocks) {
        expect(find.textContaining('mock credentials'), findsOneWidget);
      } else {
        expect(find.textContaining('mock credentials'), findsNothing);
      }
    });

    testWidgets('does not overflow on the narrowest phone', (tester) async {
      await pumpAt(
        tester,
        const LoginScreen(),
        size: const Size(320, 568),
        repo: _FakeAuthRepository(),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('a long server message still fits', (tester) async {
      final repo = _FakeAuthRepository(
        onLogin: (_, _) => Future<UserSession>.error(
          const AuthException(
            'We could not verify those details against the Kumvwa records. '
            'Please check the number and try again.',
          ),
        ),
      );
      await pumpAt(
        tester,
        const LoginScreen(),
        size: const Size(320, 568),
        repo: repo,
      );

      await tester.enterText(find.byType(TextField).at(0), '971234567');
      await tester.enterText(find.byType(TextField).at(1), 'kumvwa123');
      await tester.tap(find.text('Log In'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('could not verify'), findsOneWidget);
    });
  });
}
