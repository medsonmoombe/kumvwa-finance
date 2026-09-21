import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/utils/format.dart';

/// Money text in the bold Poppins style, with tabular numerals so amounts
/// align vertically in lists.
class AmountText extends StatelessWidget {
  const AmountText(
    this.amount, {
    super.key,
    this.decimals = 0,
    this.fontSize = 14,
    this.color,
    this.fontWeight = FontWeight.w700,
  });

  final num amount;
  final int decimals;
  final double fontSize;
  final Color? color;
  final FontWeight fontWeight;

  @override
  Widget build(BuildContext context) {
    return Text(
      Fmt.money(amount, decimals: decimals),
      maxLines: 1,
      style: GoogleFonts.poppins(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        fontFeatures: const [FontFeature.tabularFigures()],
      ),
    );
  }
}
