import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Pill-shaped filter chip used on list screens (Clients, Loans).
class AppFilterChip extends StatelessWidget {
  const AppFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        onTap();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? AppColors.blue600 : AppColors.card,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(
            color: selected ? AppColors.blue600 : AppColors.line,
          ),
        ),
        child: Text(
          label,
          style: AppText.subText.copyWith(
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : AppColors.ink2,
          ),
        ),
      ),
    );
  }
}
