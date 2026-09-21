import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/onboarding/domain/onboarding_controller.dart';
import 'package:kumvwa_finance/features/onboarding/domain/onboarding_state.dart';
import 'package:kumvwa_finance/features/onboarding/domain/user_role.dart';

void main() {
  group('OnboardingState', () {
    test('defaults to business role with terms unaccepted', () {
      const state = OnboardingState();

      expect(state.termsAccepted, isFalse);
      expect(state.role, UserRole.business);
    });

    test('copyWith replaces only the given fields', () {
      const state = OnboardingState();

      expect(state.copyWith(termsAccepted: true).role, UserRole.business);
      expect(state.copyWith(role: UserRole.client).termsAccepted, isFalse);
      expect(
        state.copyWith(termsAccepted: true, role: UserRole.client).role,
        UserRole.client,
      );
    });
  });

  group('OnboardingController', () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
      addTearDown(container.dispose);
    });

    OnboardingState stateOf() => container.read(onboardingControllerProvider);

    test('starts from the default state', () {
      expect(stateOf().termsAccepted, isFalse);
      expect(stateOf().role, UserRole.business);
    });

    test('toggleTerms flips the flag both ways', () {
      final controller = container.read(onboardingControllerProvider.notifier);

      controller.toggleTerms();
      expect(stateOf().termsAccepted, isTrue);

      controller.toggleTerms();
      expect(stateOf().termsAccepted, isFalse);
    });

    test('selectRole switches the account type', () {
      final controller = container.read(onboardingControllerProvider.notifier);

      controller.selectRole(UserRole.client);
      expect(stateOf().role, UserRole.client);

      controller.selectRole(UserRole.business);
      expect(stateOf().role, UserRole.business);
    });

    test('toggling terms leaves the role untouched', () {
      final controller = container.read(onboardingControllerProvider.notifier);

      controller.selectRole(UserRole.client);
      controller.toggleTerms();

      expect(stateOf().role, UserRole.client);
      expect(stateOf().termsAccepted, isTrue);
    });
  });
}
