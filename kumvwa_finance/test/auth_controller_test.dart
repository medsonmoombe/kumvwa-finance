import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

const session = UserSession(
  token: 'mock-jwt',
  userId: 'usr_001',
  displayName: 'Chilenje Community SACCO',
  phone: '0971234567',
  role: 'business',
);

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository({this.restored, this.restoreError, this.loginError});

  final UserSession? restored;
  final Object? restoreError;
  final Object? loginError;

  var restoreCalls = 0;
  var loginCalls = 0;
  var logoutCalls = 0;
  var lastPhone = '';
  var lastPassword = '';

  @override
  Future<UserSession?> restoreSession() async {
    restoreCalls++;
    if (restoreError != null) throw restoreError!;
    return restored;
  }

  @override
  Future<UserSession> login({
    required String phone,
    required String password,
  }) async {
    loginCalls++;
    lastPhone = phone;
    lastPassword = password;
    if (loginError != null) throw loginError!;
    return session;
  }

  @override
  Future<void> logout() async => logoutCalls++;
}

ProviderContainer containerWith(AuthRepository repo) {
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(repo),
      // No brand hold in tests — the splash floor is a presentation concern.
      splashHoldDurationProvider.overrideWithValue(Duration.zero),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

AuthState stateOf(ProviderContainer c) => c.read(authControllerProvider);

/// ProviderContainer is lazy — the controller only starts its async session
/// restore once something reads it. Read first, then drain the event queue.
Future<ProviderContainer> settled(AuthRepository repo) async {
  final container = containerWith(repo);
  container.read(authControllerProvider);
  await pumpEventQueue();
  return container;
}

void main() {
  group('session restore', () {
    test('starts in the restoring state', () {
      final container = containerWith(_FakeAuthRepository());

      expect(stateOf(container).status, AuthStatus.restoring);
    });

    test('resolves to authenticated when a session is stored', () async {
      final container = await settled(_FakeAuthRepository(restored: session));

      expect(stateOf(container).status, AuthStatus.authenticated);
      expect(stateOf(container).session?.displayName, session.displayName);
    });

    test('resolves to unauthenticated when nothing is stored', () async {
      final container = await settled(_FakeAuthRepository());

      expect(stateOf(container).status, AuthStatus.unauthenticated);
      expect(stateOf(container).session, isNull);
    });

    test('fails open to unauthenticated when the store throws', () async {
      final container = await settled(
        _FakeAuthRepository(restoreError: StateError('keystore exploded')),
      );

      expect(stateOf(container).status, AuthStatus.unauthenticated);
    });
  });

  group('login', () {
    test('authenticates and stores the session on success', () async {
      final repo = _FakeAuthRepository();
      final container = await settled(repo);

      await container
          .read(authControllerProvider.notifier)
          .login('0971234567', 'kumvwa123');

      expect(repo.loginCalls, 1);
      expect(repo.lastPhone, '0971234567');
      expect(repo.lastPassword, 'kumvwa123');
      expect(stateOf(container).status, AuthStatus.authenticated);
      expect(stateOf(container).session?.token, 'mock-jwt');
      expect(stateOf(container).isSubmitting, isFalse);
      expect(stateOf(container).errorMessage, isNull);
    });

    test('surfaces an AuthException message and stops submitting', () async {
      final container = await settled(
        _FakeAuthRepository(
          loginError: const AuthException('Invalid phone number or password'),
        ),
      );

      await container
          .read(authControllerProvider.notifier)
          .login('0971234567', 'wrong');

      expect(
        stateOf(container).errorMessage,
        'Invalid phone number or password',
      );
      expect(stateOf(container).isSubmitting, isFalse);
      expect(stateOf(container).status, isNot(AuthStatus.authenticated));
    });

    test('falls back to a generic message for unexpected failures', () async {
      final container = await settled(
        _FakeAuthRepository(loginError: StateError('socket closed')),
      );

      await container
          .read(authControllerProvider.notifier)
          .login('0971234567', 'kumvwa123');

      expect(
        stateOf(container).errorMessage,
        'Something went wrong. Please try again.',
      );
      expect(stateOf(container).isSubmitting, isFalse);
    });

    test('clears a previous error when retrying', () async {
      final container = await settled(
        _FakeAuthRepository(loginError: const AuthException('nope')),
      );

      final controller = container.read(authControllerProvider.notifier);
      await controller.login('0971234567', 'wrong');
      expect(stateOf(container).errorMessage, 'nope');

      // The next attempt must not show the stale message while in flight.
      final pending = controller.login('0971234567', 'wrong');
      expect(stateOf(container).errorMessage, isNull);
      expect(stateOf(container).isSubmitting, isTrue);
      await pending;
    });
  });

  group('logout', () {
    test('clears the session and delegates to the repository', () async {
      final repo = _FakeAuthRepository(restored: session);
      final container = await settled(repo);
      expect(stateOf(container).status, AuthStatus.authenticated);

      await container.read(authControllerProvider.notifier).logout();

      expect(repo.logoutCalls, 1);
      expect(stateOf(container).status, AuthStatus.unauthenticated);
      expect(stateOf(container).session, isNull);
    });
  });

  group('UserSession JSON', () {
    test('round-trips through toJson/fromJson', () {
      final restored = UserSession.fromJson(session.toJson());

      expect(restored.token, session.token);
      expect(restored.userId, session.userId);
      expect(restored.displayName, session.displayName);
      expect(restored.phone, session.phone);
      expect(restored.role, session.role);
    });

    test('serialises every field', () {
      expect(session.toJson(), {
        'token': 'mock-jwt',
        'userId': 'usr_001',
        'displayName': 'Chilenje Community SACCO',
        'phone': '0971234567',
        'role': 'business',
      });
    });
  });
}
