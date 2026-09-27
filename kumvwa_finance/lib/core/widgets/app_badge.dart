import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

enum BadgeVariant { green, amber, red, blue }

/// Background/foreground pair for a variant — the single colour map behind
/// both [AppBadge] and [StatusTag].
(Color, Color) _variantColors(BadgeVariant variant) => switch (variant) {
  BadgeVariant.green => (AppColors.green50, AppColors.green700),
  BadgeVariant.amber => (AppColors.amber50, const Color(0xFFB26A00)),
  BadgeVariant.red => (AppColors.red50, const Color(0xFFC03538)),
  BadgeVariant.blue => (AppColors.blue50, AppColors.blue600),
};

/// Colored pill for statuses: Active / Overdue / risk levels / info tags.
class AppBadge extends StatelessWidget {
  const AppBadge(this.label, {super.key, this.variant = BadgeVariant.blue});

  final String label;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = _variantColors(variant);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label, style: AppText.caption.copyWith(color: fg)),
    );
  }
}

/// The quiet sibling of [AppBadge]: a status dot and label, no filled pill.
///
/// Use it inside list rows, where a pill competes with the content it
/// describes and three of them turn a card into a sticker sheet. Reserve
/// [AppBadge] for surfaces that hold a single status (headers, detail hero).
class StatusTag extends StatelessWidget {
  const StatusTag(this.label, {super.key, this.variant = BadgeVariant.blue});

  final String label;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final (_, Color fg) = _variantColors(variant);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          label,
          style: AppText.caption.copyWith(
            color: fg,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
