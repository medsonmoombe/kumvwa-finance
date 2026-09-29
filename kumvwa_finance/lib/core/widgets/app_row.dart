import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// A list row: icon tile, two lines of text, one trailing element.
///
/// The workhorse of the mockup's transaction lists, loan lists and application
/// lists. The hairline separator is drawn by the row, so a list only has to ask
/// the last row to skip it.
class AppRow extends StatelessWidget {
  const AppRow({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.showDivider = true,
    this.emphasiseTitle = false,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// False on the final row of a list — the mockup drops the last border.
  final bool showDivider;

  /// Renders the title in the heavier row weight used where the title is the
  /// one thing that must be read.
  final bool emphasiseTitle;

  @override
  Widget build(BuildContext context) {
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(2, 11, 2, 11),
      child: Row(
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 11)],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: emphasiseTitle
                      ? AppText.rowTitle.copyWith(fontWeight: FontWeight.w700)
                      : AppText.rowTitle,
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.rowSub,
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
        ],
      ),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(onTap: onTap, child: body),
        ),
        if (showDivider)
          const Padding(
            padding: EdgeInsets.only(left: 2),
            child: Divider(height: 1, color: AppColors.line2),
          ),
      ],
    );
  }
}

/// A settings-style row: one line, an optional leading tile, an optional value
/// count, and a chevron when it opens something.
class AppMenuRow extends StatelessWidget {
  const AppMenuRow({
    super.key,
    required this.label,
    this.onTap,
    this.leading,
    this.value,
    this.showChevron = true,
    this.danger = false,
    this.showDivider = true,
  });

  final String label;
  final VoidCallback? onTap;
  final Widget? leading;

  /// Right-hand secondary text — a count, a handle. Sits before the chevron.
  final String? value;

  final bool showChevron;
  final bool danger;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final fg = danger ? AppColors.redInk : AppColors.ink;
    final body = Padding(
      padding: const EdgeInsets.fromLTRB(4, 12, 4, 12),
      child: Row(
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 11)],
          Expanded(
            child: Text(
              label,
              style: AppText.body.copyWith(fontSize: 12.5, color: fg),
            ),
          ),
          if (value != null)
            Text(value!, style: AppText.rowSub.copyWith(fontSize: 11)),
          if (showChevron) ...[
            const SizedBox(width: 6),
            Icon(
              Icons.chevron_right_rounded,
              size: 18,
              color: danger ? AppColors.redInk : AppColors.muted,
            ),
          ],
        ],
      ),
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Material(
          color: Colors.transparent,
          child: InkWell(onTap: onTap, child: body),
        ),
        if (showDivider) const Divider(height: 1, color: AppColors.line2),
      ],
    );
  }
}

/// A tappable card that offers the user a choice — the mockup's role cards.
///
/// Built from a large round illustration, a title and a sentence, with a
/// chevron. Two of these stacked is a decision; one is an advertisement.
class ChooserCard extends StatelessWidget {
  const ChooserCard({
    super.key,
    required this.title,
    required this.description,
    required this.art,
    required this.onTap,
    this.artBackground,
  });

  final String title;
  final String description;

  /// Illustration or glyph, centred in a 62dp disc.
  final Widget art;

  /// Disc fill behind [art]. Blue reads as "for you", green as "for your
  /// business" — keep the pair distinct so the two roles never look swappable.
  final Color? artBackground;

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$title. $description',
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.chooser),
        child: Ink(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadii.chooser),
            border: Border.all(color: AppColors.line, width: 1.5),
            boxShadow: AppShadows.sh2,
          ),
          child: Row(
            children: [
              Container(
                width: 62,
                height: 62,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: artBackground ?? AppColors.blue50,
                  shape: BoxShape.circle,
                ),
                child: art,
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: AppText.chooserTitle),
                    const SizedBox(height: 3),
                    Text(
                      description,
                      style: AppText.rowSub.copyWith(height: 1.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 6),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.muted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
