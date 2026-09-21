import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Color-coded countdown to a due date:
/// red overdue/today · amber ≤7 days · blue further out.
class DueChip extends StatelessWidget {
  const DueChip({super.key, required this.dueDate});

  final DateTime dueDate;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final due = DateTime(
      dueDate.year,
      dueDate.month,
      dueDate.day,
    );
    final days = due.difference(today).inDays;

    final (Color bg, Color fg, String label) = switch (days) {
      < 0 => (
          AppColors.red50,
          const Color(0xFFC03538),
          '${-days} day${-days == 1 ? '' : 's'} overdue',
        ),
      0 => (AppColors.red50, const Color(0xFFC03538), 'Due today'),
      1 => (AppColors.amber50, const Color(0xFFB26A00), 'Due tomorrow'),
      <= 7 => (
          AppColors.amber50,
          const Color(0xFFB26A00),
          'in $days days',
        ),
      _ => (AppColors.blue50, AppColors.blue600, 'in $days days'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}
