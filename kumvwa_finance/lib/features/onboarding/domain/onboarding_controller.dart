import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/onboarding/domain/onboarding_state.dart';
import 'package:kumvwa_finance/features/onboarding/domain/user_role.dart';

/// Holds onboarding screen state: terms acceptance + selected role.
class OnboardingController extends Notifier<OnboardingState> {
  @override
  OnboardingState build() => const OnboardingState();

  void toggleTerms() =>
      state = state.copyWith(termsAccepted: !state.termsAccepted);

  void selectRole(UserRole role) => state = state.copyWith(role: role);
}

final onboardingControllerProvider =
    NotifierProvider<OnboardingController, OnboardingState>(
      OnboardingController.new,
    );
