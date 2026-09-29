import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// The semantic colour a tile can carry.
///
/// Status first, brand second: a row that leads with its state is easier to scan
/// than one that leads with its category. [neutral] is for a tile whose content
/// is neither — never reach for it just to avoid choosing.
enum TileTone { blue, green, amber, red, neutral }

/// Colour pair for a [TileTone] — a tinted disc with ink that passes contrast
/// on it. One map, so a tone always looks the same on every screen.
({Color bg, Color fg}) tileColors(TileTone tone) => switch (tone) {
  TileTone.blue => (bg: AppColors.blue50, fg: AppColors.blue600),
  TileTone.green => (bg: AppColors.green50, fg: AppColors.green700),
  TileTone.amber => (bg: AppColors.amber50, fg: AppColors.amberInk),
  TileTone.red => (bg: AppColors.red50, fg: AppColors.redInk),
  TileTone.neutral => (bg: AppColors.neutral, fg: AppColors.muted),
};

/// A small circular icon tile — the leading element on every list row.
///
/// 40dp is the mockup's row size; use [compact] (36dp) where the row is nested
/// inside a card so the ring doesn't out-weigh its content.
class IconTile extends StatelessWidget {
  const IconTile({
    super.key,
    required this.tone,
    this.icon,
    this.child,
    this.size = 40,
    this.squircle = false,
  });

  final TileTone tone;
  final IconData? icon;

  /// Overrides [icon] — pass initials or an illustration to make the tile an
  /// avatar instead of an icon badge.
  final Widget? child;

  final double size;

  /// Squares the corners off. The mockup uses this for file-upload rows, whose
  /// tiles sit against an already-dashed rectangular frame.
  final bool squircle;

  @override
  Widget build(BuildContext context) {
    final c = tileColors(tone);
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: c.bg,
        shape: squircle ? BoxShape.rectangle : BoxShape.circle,
        borderRadius: squircle ? BorderRadius.circular(size * 0.29) : null,
      ),
      child: child ?? Icon(icon, size: size * 0.4, color: c.fg),
    );
  }
}
