import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_card.dart';

/// The mockup's completion mark: a 74dp disc whose border-radius is written
/// `50% / 44% 44% 56% 56%` — a squircle-ish blob, not a circle.
///
/// The asymmetry is the point. A perfect circle reads as a generic "done" tick;
/// this is the Kumvwa mark, and it appears at the end of every flow the user
/// completes.
class SuccessMark extends StatelessWidget {
  const SuccessMark({super.key, this.size = 74, this.icon});

  final double size;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: AppGradients.dome,
        borderRadius: BorderRadius.only(
          topLeft: Radius.elliptical(size * 0.5, size * 0.44),
          topRight: Radius.elliptical(size * 0.5, size * 0.44),
          bottomLeft: Radius.elliptical(size * 0.5, size * 0.56),
          bottomRight: Radius.elliptical(size * 0.5, size * 0.56),
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0xBF1A4FBF),
            blurRadius: 30,
            offset: Offset(0, 16),
            spreadRadius: -14,
          ),
        ],
      ),
      child: Icon(
        icon ?? Icons.check_rounded,
        size: size * 0.46,
        color: Colors.white,
      ),
    );
  }
}

/// One confirmed step on a success screen — what happened, and to what.
class SuccessCheckRow extends StatelessWidget {
  const SuccessCheckRow({
    super.key,
    required this.title,
    required this.subtitle,
    this.leading,
    this.showDivider = true,
  });

  final String title;
  final String subtitle;

  /// Overrides the check ring — a monogram, an institution glyph. A row that
  /// confirms a payment TO someone should name them.
  final Widget? leading;

  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              leading ??
                  Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white,
                      border: Border.all(color: AppColors.line2, width: 1.5),
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 22,
                      color: AppColors.blue500,
                    ),
                  ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.rowTitle),
                    const SizedBox(height: 2),
                    Text(subtitle, style: AppText.rowSub),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (showDivider) const Divider(height: 1, color: AppColors.line2),
      ],
    );
  }
}

/// A success / receipt screen: the mark, a headline, an optional leading figure,
/// a checklist of what happened, and one way out.
///
/// The checklist is not decoration. It is the receipt: what the user needs in
/// order to trust the outcome, query it later, or prove it to someone. Order it
/// the way they'd tell the story — who, what, how much, when, reference.
class SuccessScreen extends StatelessWidget {
  const SuccessScreen({
    super.key,
    required this.title,
    required this.subtitle,
    this.amount,
    this.amountLabel,
    this.checks = const [],
    required this.primaryLabel,
    required this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.busy = false,
    this.markIcon,
    this.bottom,
  });

  final String title;
  final String subtitle;

  /// Rendered large above the checklist when the flow moved money. Omit for
  /// flows where no single figure is the point.
  final String? amount;
  final String? amountLabel;

  final List<SuccessCheckRow> checks;

  final String primaryLabel;
  final VoidCallback onPrimary;

  /// The centred text link under the button.
  final String? secondaryLabel;
  final VoidCallback? onSecondary;

  final bool busy;
  final IconData? markIcon;

  /// Extra content between the checklist and the button — usually the reference
  /// number, or a note about when funds land.
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    final n = checks.length;
    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppInsets.success,
          24,
          AppInsets.success,
          24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(child: SuccessMark(icon: markIcon)),
            const SizedBox(height: 12),
            Text(
              title,
              style: AppText.cardTitle.copyWith(fontSize: 18),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 5),
            Text(
              subtitle,
              style: AppText.paragraph.copyWith(
                color: AppColors.muted,
                fontSize: 12,
              ),
              textAlign: TextAlign.center,
            ),
            if (amount != null) ...[
              const SizedBox(height: 18),
              Center(
                child: Column(
                  children: [
                    if (amountLabel != null) ...[
                      Text(
                        amountLabel!.toUpperCase(),
                        style: AppText.eyebrowInk,
                      ),
                      const SizedBox(height: 4),
                    ],
                    Text(
                      amount!,
                      style: AppText.receiptAmount,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ],
            if (n > 0) ...[
              const SizedBox(height: 20),
              // The last row drops its hairline — the checklist reads as one
              // block, not as a list that got cut off.
              for (var i = 0; i < n; i++)
                SuccessCheckRow(
                  title: checks[i].title,
                  subtitle: checks[i].subtitle,
                  leading: checks[i].leading,
                  showDivider: i < n - 1,
                ),
            ],
            if (bottom != null) ...[const SizedBox(height: 16), bottom!],
            const SizedBox(height: 18),
            AppButton(label: primaryLabel, onPressed: onPrimary, busy: busy),
            if (secondaryLabel != null && onSecondary != null) ...[
              const SizedBox(height: 12),
              GestureDetector(
                onTap: onSecondary,
                behavior: HitTestBehavior.opaque,
                child: Text(
                  secondaryLabel!,
                  style: AppText.paragraph.copyWith(
                    color: AppColors.blue500,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The reference/next-steps panel the mockup puts under the checklist.
class ReceiptFootnote extends StatelessWidget {
  const ReceiptFootnote({
    super.key,
    required this.title,
    required this.message,
  });

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: AppText.rowTitle),
          const SizedBox(height: 3),
          Text(message, style: AppText.paragraph.copyWith(fontSize: 11)),
        ],
      ),
    );
  }
}
