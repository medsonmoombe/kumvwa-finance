import 'package:kumvwa_finance/features/auth/domain/business_type.dart';

enum RegistrationStep { businessInfo, ownerInfo, verification, review }

extension RegistrationStepX on RegistrationStep {
  int get number => index + 1;

  String get title => switch (this) {
    RegistrationStep.businessInfo => 'Business details',
    RegistrationStep.ownerInfo => 'Owner details',
    RegistrationStep.verification => 'Verification',
    RegistrationStep.review => 'Review & submit',
  };
}

class BusinessRegistrationState {
  const BusinessRegistrationState({
    this.step = RegistrationStep.businessInfo,
    this.businessName = '',
    this.businessType,
    this.ownerNrc = '',
    this.phone = '',
    this.certificateName,
    this.certificatePath,
  });

  final RegistrationStep step;
  final String businessName;
  final BusinessType? businessType;
  final String ownerNrc;
  final String phone;
  final String? certificateName;
  final String? certificatePath;

  bool get hasCertificate => certificateName != null;

  BusinessRegistrationState copyWith({
    RegistrationStep? step,
    String? businessName,
    BusinessType? businessType,
    String? ownerNrc,
    String? phone,
    String? certificateName,
    String? certificatePath,
  }) {
    return BusinessRegistrationState(
      step: step ?? this.step,
      businessName: businessName ?? this.businessName,
      businessType: businessType ?? this.businessType,
      ownerNrc: ownerNrc ?? this.ownerNrc,
      phone: phone ?? this.phone,
      certificateName: certificateName ?? this.certificateName,
      certificatePath: certificatePath ?? this.certificatePath,
    );
  }
}
