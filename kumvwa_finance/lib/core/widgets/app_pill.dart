import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// A selectable pill — the mockup's amount and option chooser.
///
/// Mutually exclusive within a row; if two can be active at once, this is the
/// wrong control and a [AppToggle] or a checkbox is what you want.
class AppPill extends StatelessWidget {
  const AppPill({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.icon,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            color: selected ? AppColors.blue500 : Colors.white,
            borderRadius: BorderRadius.circular(AppRadii.pill),
            border: Border.all(
              color: selected ? AppColors.blue500 : AppColors.line,
              width: 1.5,
            ),
            boxShadow: selected ? AppShadows.shPill : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 13,
                  color: selected ? Colors.white : AppColors.ink2,
                ),
                const SizedBox(width: 5),
              ],
              Text(
                label,
                style: AppText.pillLabel.copyWith(
                  color: selected ? Colors.white : AppColors.ink2,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// A wrapping row of [AppPill]s, each owning its own selected flag.
class AppPillGroup extends StatelessWidget {
  const AppPillGroup({
    super.key,
    required this.options,
    required this.selected,
    required this.onChanged,
    this.spacing = 8,
  });

  /// Value first, then label — the order pills are laid out in.
  final List<(String, String)> options;
  final String selected;
  final ValueChanged<String> onChanged;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: spacing,
      runSpacing: spacing,
      children: [
        for (final (value, label) in options)
          AppPill(
            label: label,
            selected: value == selected,
            onTap: () => onChanged(value),
          ),
      ],
    );
  }
}
