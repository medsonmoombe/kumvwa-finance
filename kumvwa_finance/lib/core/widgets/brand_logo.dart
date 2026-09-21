import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Circular brand mark (gradient disc + growth bars + arrow).
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 48});

  final double size;

  static const _asset = 'assets/brand/kumvwa_mark.svg';

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(_asset, width: size, height: size);
  }
}

/// Mark + wordmark composed in Flutter so the font always renders.
/// Use on light backgrounds.
class BrandLogo extends StatelessWidget {
  const BrandLogo({super.key, this.markSize = 56, this.showWordmark = true});

  final double markSize;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        BrandMark(size: markSize),
        if (showWordmark) ...[
          const SizedBox(height: 14),
          Text(
            'Kumvwa',
            style: GoogleFonts.poppins(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
              letterSpacing: -0.3,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            'FINANCE',
            style: GoogleFonts.poppins(
              fontSize: 10.5,
              fontWeight: FontWeight.w600,
              color: AppColors.blue600,
              letterSpacing: 5,
            ),
          ),
        ],
      ],
    );
  }
}
