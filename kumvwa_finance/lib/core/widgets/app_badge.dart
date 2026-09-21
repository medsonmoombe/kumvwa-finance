import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

enum BadgeVariant { green, amber, red, blue }

/// Colored pill for statuses: Active / Overdue / risk levels / info tags.
class AppBadge extends StatelessWidget {
  const AppBadge(this.label, {super.key, this.variant = BadgeVariant.blue});

  final String label;
  final BadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (variant) {
      BadgeVariant.green => (AppColors.green50, AppColors.green700),
      BadgeVariant.amber => (AppColors.amber50, const Color(0xFFB26A00)),
      BadgeVariant.red => (AppColors.red50, const Color(0xFFC03538)),
      BadgeVariant.blue => (AppColors.blue50, AppColors.blue600),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: AppText.caption.copyWith(color: fg),
      ),
    );
  }
}
