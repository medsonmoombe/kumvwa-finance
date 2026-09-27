import 'package:intl/intl.dart';

/// Money, date and name formatting shared across features.
class Fmt {
  Fmt._();

  /// 245800 → 'K 245,800'
  static String money(num amount, {int decimals = 0}) {
    final n = NumberFormat.decimalPattern()
      ..minimumFractionDigits = decimals
      ..maximumFractionDigits = decimals;
    return 'K ${n.format(amount)}';
  }

  /// DateTime → '12 Aug 2025'
  static String date(DateTime d) => DateFormat('d MMM yyyy').format(d);

  /// '+260971234567' or '0971234567' → '+260 97 ••• 4567'.
  ///
  /// Keeps the country code and the last four digits (the parts a client
  /// recognises on their own line) and hides the middle, so the number is
  /// safe to show in a receipt, screenshot or lender conversation.
  /// Unparseable input degrades to a fully masked placeholder.
  static String maskPhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
    final national = digits.startsWith('260')
        ? digits.substring(3)
        : digits.startsWith('0')
        ? digits.substring(1)
        : digits;
    if (national.length < 7) return '••• ••••';
    return '+260 ${national.substring(0, 2)} ••• '
        '${national.substring(national.length - 4)}';
  }

  /// 'Mwansa Bwalya' → 'MB'
  static String initials(String name) {
    final parts = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
        .toUpperCase();
  }
}
