import 'package:kumvwa_finance/features/onboarding/domain/user_role.dart';

class OnboardingState {
  const OnboardingState({
    this.termsAccepted = false,
    this.role = UserRole.business,
  });

  final bool termsAccepted;
  final UserRole role;

  OnboardingState copyWith({bool? termsAccepted, UserRole? role}) {
    return OnboardingState(
      termsAccepted: termsAccepted ?? this.termsAccepted,
      role: role ?? this.role,
    );
  }
}
