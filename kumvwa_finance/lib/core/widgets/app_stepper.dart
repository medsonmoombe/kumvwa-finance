import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Segmented progress indicator — one bar per step, filled up to [current].
class AppStepper extends StatelessWidget {
  const AppStepper({super.key, required this.steps, required this.current});

  final int steps;
  final int current; // 0-based

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(steps, (i) {
        final filled = i <= current;
        return Expanded(
          child: Container(
            height: 4,
            margin: EdgeInsets.only(right: i == steps - 1 ? 0 : 5),
            decoration: BoxDecoration(
              // Stepper track is slightly lighter than --line, per mockup
              color: filled ? AppColors.blue600 : const Color(0xFFE1E6F0),
              borderRadius: BorderRadius.circular(99),
            ),
          ),
        );
      }),
    );
  }
}
