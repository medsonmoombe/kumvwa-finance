import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Rounded-square checkbox used for terms/consent rows.
class AppCheckbox extends StatelessWidget {
  const AppCheckbox({
    super.key,
    required this.checked,
    required this.onChanged,
    this.activeColor = AppColors.blue600,
  });

  final bool checked;
  final ValueChanged<bool> onChanged;
  final Color activeColor;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => onChanged(!checked),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: checked ? activeColor : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: checked ? activeColor : AppColors.muted,
            width: 1.5,
          ),
        ),
        child: checked
            ? const Icon(Icons.check, size: 12, color: Colors.white)
            : null,
      ),
    );
  }
}
