import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';

/// One figure in a [StatsStrip].
class StatFigure {
  const StatFigure(this.label, this.value, {this.tone});

  final String label;
  final String value;

  /// Tints the figure. Leave null for the default ink — a figure only earns a
  /// status colour when the number itself is the warning.
  final TileTone? tone;
}

/// The three-figure summary card — balance, outstanding, limit.
///
/// Deliberately not tappable: this is a statement of where the user stands, and
/// the drill-downs live in the action grid above it. Order the figures the way
/// the user asks about them (balance first, always), not the order they arrive
/// from the API.
class StatsStrip extends StatelessWidget {
  const StatsStrip({super.key, required this.stats, this.onTap});

  final List<StatFigure> stats;

  /// Makes the whole card an entry point. Omit to keep it inert.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line2),
      ),
      child: Row(
        children: [
          for (var i = 0; i < stats.length; i++) ...[
            if (i > 0)
              const SizedBox(
                height: 30,
                child: VerticalDivider(
                  width: 1,
                  thickness: 1,
                  color: AppColors.line2,
                ),
              ),
            Expanded(
              child: _Stat(
                label: stats[i].label,
                value: stats[i].value,
                tone: stats[i].tone,
              ),
            ),
          ],
        ],
      ),
    );

    if (onTap == null) return card;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: card,
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.tone});

  final String label;
  final String value;
  final TileTone? tone;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label.toUpperCase(),
          style: AppText.statLabel,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: AppText.statValue.copyWith(
            color: tone == null ? AppColors.ink : tileColors(tone!).fg,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }
}
