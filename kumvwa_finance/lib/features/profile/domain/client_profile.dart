/// The client's own profile as returned by the self-service API
/// (`/clients/me`). KYC completeness drives the wizard: the invite only
/// minted the account (name + phone = 40%), the borrower adds NRC (+20),
/// date of birth (+20) and address (+20) in the app to reach 100%.
class ClientProfile {
  const ClientProfile({
    required this.fullName,
    required this.phone,
    this.nrcMasked,
    this.dateOfBirth,
    this.address,
    required this.profilePercent,
    required this.complete,
    this.missing = const [],
  });

  final String fullName;
  final String phone;

  /// Only a masked form is ever emitted (the API stores NRC as ciphertext).
  final String? nrcMasked;
  final DateTime? dateOfBirth;
  final String? address;

  /// 0–100 completeness. 100 means [complete] is true.
  final int profilePercent;
  final bool complete;

  /// Keys ('nrc' | 'dob' | 'address') of the steps still outstanding.
  final List<String> missing;

  bool get needsNrc => nrcMasked == null;
}