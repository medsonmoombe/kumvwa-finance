import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
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
    // A failed background token refresh means the session is dead server-side.
    // ApiClient bumps this provider and we log out instead of leaving the
    // router stuck in a phantom authenticated state.
    ref.listen<int>(sessionExpiryStampProvider, (previous, next) {
      if (state.status == AuthStatus.authenticated) logout();
    });

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
      debugPrint('Session restore failed, continuing as logged out: $e');
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
    } on ApiException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } catch (e, s) {
      // Keep the toast generic, but log the actual fault so a failing attempt
      // is diagnosable from the run console instead of guessing from the UI.
      debugPrint('Login failed (unhandled): $e\n$s');
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: 'Something went wrong. Please try again.',
      );
    }
  }

  Future<LenderSignInResult?> loginLender(String email, String password) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final result = await ref.read(authRepositoryProvider).loginLender(email: email, password: password);
      if (result.session != null) state = AuthState.authenticated(result.session);
      else state = state.copyWith(isSubmitting: false);
      return result;
    } on AuthException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } on ApiException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(isSubmitting: false, errorMessage: 'Something went wrong. Please try again.');
    }
    return null;
  }

  Future<void> verifyLenderOtp(String preToken, String code) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final session = await ref.read(authRepositoryProvider).verifyLenderOtp(preToken: preToken, code: code);
      state = AuthState.authenticated(session);
    } on AuthException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } on ApiException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(isSubmitting: false, errorMessage: 'Something went wrong. Please try again.');
    }
  }

  Future<void> redeemLenderAccessCode(String code) async {
    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final session = await ref.read(authRepositoryProvider).redeemLenderAccessCode(code);
      state = AuthState.authenticated(session);
    } on AuthException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } on ApiException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(isSubmitting: false, errorMessage: 'Something went wrong. Please try again.');
    }
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AuthState.unauthenticated();
  }

  /// Post-KYC refresh: swap the session (same token, updated profile fields).
  /// No-op unless currently authenticated.
  void applyUpdatedSession(UserSession updated) {
    if (state.status == AuthStatus.authenticated) {
      state = AuthState.authenticated(updated);
    }
  }

  /// Re-mints the short-lived profile-image URL after it expires, so a photo
  /// that has been on screen a while doesn't quietly revert to initials.
  /// Awaits nothing the UI depends on, and no-ops when signed out or offline.
  Future<void> refreshProfileImage() async {
    if (state.status != AuthStatus.authenticated) return;
    final fresh = await ref.read(authRepositoryProvider).refreshProfileImage();
    if (fresh != null && fresh.profileImageUrl != null) {
      applyUpdatedSession(fresh);
    }
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
