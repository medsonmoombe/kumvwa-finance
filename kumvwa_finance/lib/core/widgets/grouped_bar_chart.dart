import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Simple grouped bar chart (two series), no packages.
/// Bars scale to the max across all groups; labels render below.
class GroupedBarChart extends StatelessWidget {
  const GroupedBarChart({super.key, required this.groups});

  final List<BarGroup> groups;

  @override
  Widget build(BuildContext context) {
    final maxVal = groups.fold<double>(
      0,
      (m, g) => m < g.disbursed ? g.disbursed : (m < g.collected ? g.collected : m),
    );
    // Guard against an all-zero (or empty) series so we never divide by zero.
    final scale = maxVal > 0 ? maxVal : 1.0;

    return Column(
      children: [
        SizedBox(
          height: 140,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final g in groups)
                Expanded(
                  child: _BarPair(
                    disbursed: g.disbursed / scale,
                    collected: g.collected / scale,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            for (final g in groups)
              Expanded(
                child: Text(
                  g.label,
                  textAlign: TextAlign.center,
                  style: AppText.caption,
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class BarGroup {
  const BarGroup({
    required this.label,
    required this.disbursed,
    required this.collected,
  });

  final String label;
  final double disbursed;
  final double collected;
}

class _BarPair extends StatelessWidget {
  const _BarPair({required this.disbursed, required this.collected});

  final double disbursed;
  final double collected;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        FractionallySizedBox(
          heightFactor: disbursed,
          child: _bar(AppColors.blue600),
        ),
        const SizedBox(width: 3),
        FractionallySizedBox(
          heightFactor: collected,
          child: _bar(AppColors.green500),
        ),
      ],
    );
  }

  Widget _bar(Color color) {
    return Container(
      width: 10,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
      ),
    );
  }
}

/// Blue = disbursed, green = collected legend row.
class ChartLegend extends StatelessWidget {
  const ChartLegend({super.key});

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        _Dot(color: AppColors.blue600, label: 'Disbursed'),
        SizedBox(width: 16),
        _Dot(color: AppColors.green500, label: 'Collected'),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, required this.label});

  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: AppText.subText.copyWith(color: AppColors.ink2),
        ),
      ],
    );
  }
}
