/// Form validators shared across features.
/// All return `null` when valid, or an error message string.
class Validators {
  Validators._();

  static final RegExp _nrc = RegExp(r'^\d{6}/\d{2}/\d$');
  // Accepts 0971234567 / 0761234567 / +260971234567 / 260971234567
  static final RegExp _zmPhone = RegExp(r'^(?:\+?260|0)?[97]\d{8}$');

  static String? required(String? value, {String field = 'This field'}) {
    if (value == null || value.trim().isEmpty) return '$field is required';
    return null;
  }

  static String? nrc(String? value) {
    final v = value?.replaceAll(' ', '') ?? '';
    if (v.isEmpty) return 'NRC number is required';
    if (!_nrc.hasMatch(v)) return 'Enter a valid NRC (e.g. 245711/63/1)';
    return null;
  }

  static String? zmPhone(String? value) {
    final v = value?.replaceAll(' ', '') ?? '';
    if (v.isEmpty) return 'Phone number is required';
    if (!_zmPhone.hasMatch(v)) {
      return 'Enter a valid Zambian number (e.g. 0971234567)';
    }
    return null;
  }

  static String? password(String? value) {
    final v = value ?? '';
    if (v.isEmpty) return 'Password is required';
    // Matches the API contract (auth DTOs enforce min 8).
    if (v.length < 8) return 'Must be at least 8 characters';
    return null;
  }

  /// Date-of-birth check for the borrower self-service profile: 18+.
  static String? adultDob(DateTime? dob) {
    if (dob == null) return 'Date of birth is required';
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      age--;
    }
    if (age < 18) return 'You must be at least 18 years old';
    return null;
  }
}
