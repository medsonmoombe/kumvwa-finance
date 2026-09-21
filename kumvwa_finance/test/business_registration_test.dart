import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/auth/domain/business_registration_state.dart';
import 'package:kumvwa_finance/features/auth/domain/business_type.dart';
import 'package:kumvwa_finance/features/auth/presentation/business_registration_controller.dart';

void main() {
  group('RegistrationStepX', () {
    test('numbers steps from 1', () {
      expect(RegistrationStep.businessInfo.number, 1);
      expect(RegistrationStep.ownerInfo.number, 2);
      expect(RegistrationStep.verification.number, 3);
      expect(RegistrationStep.review.number, 4);
    });

    test('gives every step a title', () {
      expect(RegistrationStep.businessInfo.title, 'Business details');
      expect(RegistrationStep.ownerInfo.title, 'Owner details');
      expect(RegistrationStep.verification.title, 'Verification');
      expect(RegistrationStep.review.title, 'Review & submit');
    });
  });

  group('BusinessType', () {
    test('carries the display label', () {
      expect(BusinessType.sacco.label, 'SACCO / Cooperative');
      expect(BusinessType.mfi.label, 'Microfinance Institution');
      expect(BusinessType.individualLender.label, 'Individual Lender');
      expect(BusinessType.other.label, 'Other');
    });
  });

  group('BusinessRegistrationState', () {
    test('defaults to the first step with empty fields', () {
      const state = BusinessRegistrationState();

      expect(state.step, RegistrationStep.businessInfo);
      expect(state.businessName, isEmpty);
      expect(state.businessType, isNull);
      expect(state.ownerNrc, isEmpty);
      expect(state.phone, isEmpty);
      expect(state.hasCertificate, isFalse);
    });

    test('hasCertificate follows certificateName', () {
      expect(
        const BusinessRegistrationState(certificateName: 'boz.pdf')
            .hasCertificate,
        isTrue,
      );
      expect(
        const BusinessRegistrationState(certificateName: 'boz.pdf')
            .copyWith(certificateName: '')
            .hasCertificate,
        isTrue, // copyWith only replaces with non-null
      );
    });

    test('copyWith replaces only the given fields', () {
      const state = BusinessRegistrationState(businessName: 'Acme');
      final next = state.copyWith(step: RegistrationStep.review);

      expect(next.businessName, 'Acme');
      expect(next.step, RegistrationStep.review);
    });
  });

  group('BusinessRegistrationController', () {
    late ProviderContainer container;
    late BusinessRegistrationController controller;

    setUp(() {
      container = ProviderContainer();
      addTearDown(container.dispose);
      controller = container.read(businessRegistrationControllerProvider.notifier);
    });

    BusinessRegistrationState stateOf() =>
        container.read(businessRegistrationControllerProvider);

    test('nextStep advances through all four steps', () {
      expect(stateOf().step, RegistrationStep.businessInfo);

      controller.nextStep();
      expect(stateOf().step, RegistrationStep.ownerInfo);

      controller.nextStep();
      expect(stateOf().step, RegistrationStep.verification);

      controller.nextStep();
      expect(stateOf().step, RegistrationStep.review);
    });

    test('nextStep clamps at the last step', () {
      for (var i = 0; i < 6; i++) {
        controller.nextStep();
      }

      expect(stateOf().step, RegistrationStep.review);
    });

    test('previousStep walks back and clamps at the first step', () {
      controller.nextStep();
      controller.nextStep();
      expect(stateOf().step, RegistrationStep.verification);

      controller.previousStep();
      expect(stateOf().step, RegistrationStep.ownerInfo);

      controller.previousStep();
      controller.previousStep();
      expect(stateOf().step, RegistrationStep.businessInfo);
    });

    test('setBusinessInfo trims the name and records the type', () {
      controller.setBusinessInfo('  Chilenje Community SACCO  ', BusinessType.sacco);

      expect(stateOf().businessName, 'Chilenje Community SACCO');
      expect(stateOf().businessType, BusinessType.sacco);
    });

    test('setOwnerInfo trims both fields', () {
      controller.setOwnerInfo(' 245711/63/1 ', ' 0971234567 ');

      expect(stateOf().ownerNrc, '245711/63/1');
      expect(stateOf().phone, '0971234567');
    });

    test('setCertificate stores the file name and path', () {
      controller.setCertificate('boz-cert.pdf', '/tmp/boz-cert.pdf');

      expect(stateOf().certificateName, 'boz-cert.pdf');
      expect(stateOf().certificatePath, '/tmp/boz-cert.pdf');
      expect(stateOf().hasCertificate, isTrue);
    });

    test('reset returns to a blank first step', () {
      controller.nextStep();
      controller.setBusinessInfo('Acme', BusinessType.mfi);
      controller.setCertificate('c.pdf', '/tmp/c.pdf');

      controller.reset();

      expect(stateOf().step, RegistrationStep.businessInfo);
      expect(stateOf().businessName, isEmpty);
      expect(stateOf().businessType, isNull);
      expect(stateOf().certificateName, isNull);
      expect(stateOf().hasCertificate, isFalse);
    });

    test('advancing steps preserves already-entered data', () {
      controller.setBusinessInfo('Acme', BusinessType.mfi);
      controller.nextStep();
      controller.setOwnerInfo('245711/63/1', '0971234567');
      controller.nextStep();

      expect(stateOf().businessName, 'Acme');
      expect(stateOf().ownerNrc, '245711/63/1');
      expect(stateOf().step, RegistrationStep.verification);
    });
  });
}
