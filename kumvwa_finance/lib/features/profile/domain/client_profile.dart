/// The client's own profile as returned by the self-service API
/// (`/clients/me`). KYC completeness drives the wizard: the invite only
/// minted the account (name + phone = 40%), the borrower adds NRC (+20),
/// date of birth (+20) and address (+20) in the app to reach 100%.
class ClientProfile {
  const ClientProfile({
    required this.fullName,
    required this.phone,
    this.email,
    this.nrcMasked,
    this.dateOfBirth,
    this.address,
    this.employmentStatus,
    this.educationLevel,
    this.incomeBand,
    this.incomeSource,
    this.kinName,
    this.kinPhone,
    this.nrcPhotoFileId,
    this.nrcBackPhotoFileId,
    this.missingRegistrationFields = const [],
    this.registrationOpenLoanCount = 0,
    this.registrationOpenTotal = 0,
    required this.profilePercent,
    required this.complete,
    this.missing = const [],
  });

  final String fullName;
  final String phone;
  final String? email;
  final String? nrcMasked;
  final DateTime? dateOfBirth;
  final String? address;
  final String? employmentStatus;
  final String? educationLevel;
  final String? incomeBand;
  final String? incomeSource;
  final String? kinName;
  final String? kinPhone;

  /// Uploaded NRC faces. Both are optional, but the stepper shows an already
  /// captured side as done instead of asking for it again.
  final String? nrcPhotoFileId;
  final String? nrcBackPhotoFileId;

  /// Required registration fields the server reports as still missing
  /// (`registration.missing`). Authoritative on the real API; empty in mock
  /// mode, where [missingRegistrationFields] is derived from the values above.
  final List<String> missingRegistrationFields;

  /// Loans still awaiting repayment, as the server counts them for the
  /// registration gate. A borrower who owes money clears it before the stepper
  /// binds them.
  final int registrationOpenLoanCount;
  final double registrationOpenTotal;

  final int profilePercent;
  final bool complete;
  final List<String> missing;

  bool get needsNrc => nrcMasked == null;
  bool get hasNrcFront => nrcPhotoFileId != null;
  bool get hasNrcBack => nrcBackPhotoFileId != null;
}
