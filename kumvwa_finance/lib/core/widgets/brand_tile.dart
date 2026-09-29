import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// The mark as the mockup draws it: the brand gradient on a rounded square with
/// a "K" cut into it.
///
/// This is the *compact* identity — sized for a back-bar or a nav rail. The full
/// circular [BrandMark] is the launcher-icon form and is not interchangeable with
/// it: one is a squircle tile, the other a disc with growth bars. Pick per
/// surface; don't mix the two inside a single lockup.
class BrandTile extends StatelessWidget {
  const BrandTile({super.key, this.size = 34, this.radius});

  final double size;

  /// Defaults to ~30% of [size], the mockup's proportion (34 -> 10, 36 -> 11).
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final r = radius ?? size * 0.295;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: AppGradients.brand,
        borderRadius: BorderRadius.circular(r),
      ),
      child: Text(
        'K',
        style: AppText.navLabelOn.copyWith(
          fontSize: size * 0.46,
          color: Colors.white,
          height: 1,
        ),
      ),
    );
  }
}

/// Circular brand mark — the gradient disc with growth bars and an arrow. This
/// is the launcher-icon form and the one the mockup shows on its splash and
/// login screens.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 48});

  final double size;

  static const _asset = 'assets/brand/kumvwa_mark.svg';

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      _asset,
      width: size,
      height: size,
      semanticsLabel: 'Kumvwa Finance',
    );
  }
}

/// Mark + wordmark, composed in Flutter so the font always renders — the logo
/// SVG's lettering depends on a font that isn't guaranteed to resolve on device.
///
/// [axis] picks the arrangement: [Axis.horizontal] for a back-bar or nav rail
/// where height is scarce, [Axis.vertical] for a splash or a login header where
/// the mark leads.
class BrandLockup extends StatelessWidget {
  const BrandLockup({
    super.key,
    this.markSize = 34,
    this.wordmarkSize = 13,
    this.axis = Axis.horizontal,
    this.onDark = false,
  });

  final double markSize;
  final double wordmarkSize;
  final Axis axis;

  /// Flips the wordmark to white for a gradient surface. The default is the
  /// ink-on-light form every light screen uses.
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    final mark = axis == Axis.vertical
        ? BrandMark(size: markSize)
        : BrandTile(size: markSize);

    final wordmark = Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: axis == Axis.vertical
          ? CrossAxisAlignment.center
          : CrossAxisAlignment.start,
      children: [
        Text(
          'Kumvwa',
          style: AppText.navLabelOn.copyWith(
            fontSize: wordmarkSize,
            color: onDark ? Colors.white : AppColors.blue900,
            letterSpacing: -0.2,
            height: 1.15,
          ),
        ),
        Text(
          'FINANCE',
          style: AppText.navLabelOn.copyWith(
            fontSize: wordmarkSize * 0.52,
            color: onDark ? AppColors.onGradientEyebrow : AppColors.muted,
            letterSpacing: wordmarkSize * 0.2,
            height: 1.15,
          ),
        ),
      ],
    );

    if (axis == Axis.vertical) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          mark,
          SizedBox(height: markSize * 0.22),
          wordmark,
        ],
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        SizedBox(width: markSize * 0.28),
        wordmark,
      ],
    );
  }
}
