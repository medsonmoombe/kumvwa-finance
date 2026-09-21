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
