import 'package:flutter/painting.dart';

extension HexColor on String {
  /// '#7C3AED' → [Color]. Null on malformed input (callers fall back to brand).
  Color? toColor() {
    final hex = replaceAll('#', '');
    if (hex.length != 6) return null;
    final v = int.tryParse('FF$hex', radix: 16);
    return v == null ? null : Color(v);
  }
}

/// Darker shade for gradient ends ([amount] 0..1).
Color darken(Color c, [double amount = .35]) {
  final hsl = HSLColor.fromColor(c);
  return hsl.withLightness((hsl.lightness - amount).clamp(0.0, 1.0)).toColor();
}
