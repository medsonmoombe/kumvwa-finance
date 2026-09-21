import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/auth/domain/business_registration_state.dart';
import 'package:kumvwa_finance/features/auth/domain/business_type.dart';

/// Drives the 4-step business registration flow.
/// Text fields are uncontrolled locally (in the screen) and pushed into
/// this state when the user advances a step — avoids cursor-jump bugs.
class BusinessRegistrationController
    extends Notifier<BusinessRegistrationState> {
  @override
  BusinessRegistrationState build() => const BusinessRegistrationState();

  void nextStep() {
    if (state.step.index < RegistrationStep.values.length - 1) {
      state = state.copyWith(
        step: RegistrationStep.values[state.step.index + 1],
      );
    }
  }

  void previousStep() {
    if (state.step.index > 0) {
      state = state.copyWith(
        step: RegistrationStep.values[state.step.index - 1],
      );
    }
  }

  void setBusinessInfo(String name, BusinessType type) =>
      state = state.copyWith(businessName: name.trim(), businessType: type);

  void setOwnerInfo(String nrc, String phone) =>
      state = state.copyWith(ownerNrc: nrc.trim(), phone: phone.trim());

  void setCertificate(String name, String path) =>
      state = state.copyWith(certificateName: name, certificatePath: path);

  void reset() => state = const BusinessRegistrationState();
}

final businessRegistrationControllerProvider =
    NotifierProvider<BusinessRegistrationController, BusinessRegistrationState>(
      BusinessRegistrationController.new,
    );
