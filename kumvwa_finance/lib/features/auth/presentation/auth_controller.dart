import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';

enum AuthStatus { restoring, unauthenticated, authenticated }

/// How long the splash stays visible, even when session restore is
/// instantaneous. The splash is the brand's first impression — without this
/// floor it flashes past in a few milliseconds and the wordmark is never
/// actually seen. Tests override this to [Duration.zero].
final splashHoldDurationProvider = Provider<Duration>(
  (ref) => const Duration(milliseconds: 1800),
);

class AuthState {
  const AuthState({
    required this.status,
    this.session,
    this.isSubmitting = false,
    this.errorMessage,
  });

  const AuthState.restoring()
    : status = AuthStatus.restoring,
      session = null,
      isSubmitting = false,
      errorMessage = null;

  const AuthState.unauthenticated()
    : status = AuthStatus.unauthenticated,
      session = null,
      isSubmitting = false,
      errorMessage = null;

  const AuthState.authenticated(this.session)
    : status = AuthStatus.authenticated,
      isSubmitting = false,
      errorMessage = null;

  final AuthStatus status;
  final UserSession? session;
  final bool isSubmitting;
  final String? errorMessage;

  AuthState copyWith({
    bool? isSubmitting,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      status: status,
      session: session,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    _restore();
    return const AuthState.restoring();
  }

  Future<void> _restore() async {
    // Brand moment: the splash must be on screen a beat, not a flash.
    final shown = Stopwatch()..start();
    try {
      // Fail open: a hung or broken secure store must never trap the
      // user on the splash screen — worst case we land on Login.
      final session = await ref
          .read(authRepositoryProvider)
          .restoreSession()
          .timeout(const Duration(seconds: 6), onTimeout: () => null);

      final hold = ref.read(splashHoldDurationProvider);
      final remaining = hold - shown.elapsed;
      if (remaining > Duration.zero) {
        await Future<void>.delayed(remaining);
      }

      state = session == null
          ? const AuthState.unauthenticated()
          : AuthState.authenticated(session);
    } catch (e) {
      debugPrint('Session restore failed — continuing as logged out: $e');
      state = const AuthState.unauthenticated();
    }
  }

  Future<void> login(String phone, String password) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final session = await ref
          .read(authRepositoryProvider)
          .login(phone: phone, password: password);
      state = AuthState.authenticated(session);
    } on AuthException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Something went wrong. Please try again.',
      );
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState.unauthenticated();
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
