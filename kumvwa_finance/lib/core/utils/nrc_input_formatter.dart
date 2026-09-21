import 'package:flutter/services.dart';

/// Formats Zambian NRC input as ######/##/# while typing.
/// Strips everything non-numeric, caps at 9 digits, inserts "/"
/// only between groups (never trailing) so deleting feels natural.
class NrcInputFormatter extends TextInputFormatter {
  static const _maxDigits = 9;

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp('[^0-9]'), '');
    final clipped = digits.length > _maxDigits
        ? digits.substring(0, _maxDigits)
        : digits;

    final buffer = StringBuffer();
    for (var i = 0; i < clipped.length; i++) {
      buffer.write(clipped[i]);
      final isSeparatorPoint = i == 5 || i == 7;
      final hasMoreDigits = i < clipped.length - 1;
      if (isSeparatorPoint && hasMoreDigits) buffer.write('/');
    }

    return TextEditingValue(
      text: buffer.toString(),
      selection: TextSelection.collapsed(offset: buffer.length),
    );
  }
}
