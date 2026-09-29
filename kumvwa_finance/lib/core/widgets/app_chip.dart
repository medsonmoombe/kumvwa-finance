import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';

/// A status badge for a loan, application or document.
///
/// Borrowed tones from [TileTone] so a status reads the same colour in a list,
/// a card header and a receipt line. Green is not automatically "good" — a green
/// loan row in this app means approved, which is the positive case, but an
/// *overdue* loan must not reuse it.
class AppChip extends StatelessWidget {
  const AppChip({
    super.key,
    required this.label,
    this.tone = TileTone.neutral,
    this.solid = false,
    this.icon,
  });

  final String label;
  final TileTone tone;

  /// Fills with the tone's foreground instead of tinting the background. Use for
  /// the single most important status on a card.
  final bool solid;

  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = tileColors(tone);
    return Container(
      padding: EdgeInsets.fromLTRB(icon == null ? 9 : 7, 4, 9, 4),
      decoration: BoxDecoration(
        color: solid ? c.fg : c.bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 11, color: solid ? Colors.white : c.fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: AppText.chipLabel.copyWith(
              color: solid ? Colors.white : c.fg,
            ),
          ),
        ],
      ),
    );
  }
}
