import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';

/// The mockup's floating white panel: 16dp radius, a hairline, and a wide
/// negative-spread shadow so it sits above the page rather than being cut into
/// it.
///
/// [padding] defaults to the mockup's `14`. Pass a [TileTone] only when the card
/// itself is a status surface — a tinted card with a coloured heading — and pair
/// it with a matching [IconTile] so the card reads as one object.
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(14),
    this.onTap,
    this.margin,
    this.gradient,
    this.tone,
    this.borderColor,
    this.radius = AppRadii.card,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? margin;

  /// Replaces the white fill with a gradient. Use on the few cards the mockup
  /// fills with brand colour.
  final Gradient? gradient;

  final TileTone? tone;
  final Color? borderColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    final t = tone == null ? null : tileColors(tone!);
    final card = Container(
      margin: margin,
      decoration: BoxDecoration(
        color: gradient == null ? (t?.bg ?? Colors.white) : null,
        gradient: gradient,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: borderColor ?? AppColors.line2, width: 1),
        boxShadow: gradient == null ? AppShadows.sh1 : AppShadows.sh2,
      ),
      child: Padding(padding: padding, child: child),
    );

    if (onTap == null) return card;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(radius),
      child: card,
    );
  }
}

/// A label/value pair — the mockup's `.kv`, and the spine of every receipt.
///
/// The value is right-aligned and tabular so a column of them lines up and
/// doesn't shift as a figure changes.
class KeyValueRow extends StatelessWidget {
  const KeyValueRow({
    super.key,
    required this.label,
    required this.value,
    this.valueStyle,
    this.strong = false,
    this.dense = false,
    this.showDivider = true,
  });

  final String label;
  final String value;
  final TextStyle? valueStyle;

  /// The last row of a group: no hairline, heavier value.
  final bool strong;

  final bool dense;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Padding(
          padding: EdgeInsets.symmetric(vertical: dense ? 5 : 7),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  label,
                  style: AppText.paragraph.copyWith(
                    color: AppColors.muted,
                    fontWeight: strong ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 180),
                child: Text(
                  value,
                  textAlign: TextAlign.right,
                  style:
                      valueStyle ??
                      (strong
                          ? AppText.rowAmount.copyWith(color: AppColors.ink)
                          : AppText.paragraph.copyWith(
                              color: AppColors.ink,
                              fontWeight: FontWeight.w600,
                            )),
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

/// An inline notice inside a card — the mockup's `.nt`. Three intents, three
/// tones, one component, so a warning never gets mistaken for an error.
class NoticeBanner extends StatelessWidget {
  const NoticeBanner({
    super.key,
    required this.message,
    this.tone = TileTone.blue,
    this.title,
    this.icon,
    this.onTap,
    this.trailing,
  });

  final String message;
  final TileTone tone;
  final String? title;
  final IconData? icon;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = tileColors(tone);
    return Semantics(
      container: true,
      label: title == null ? message : '$title. $message',
      child: Material(
        color: c.bg,
        borderRadius: BorderRadius.circular(AppRadii.tile),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.tile),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  icon ??
                      switch (tone) {
                        TileTone.blue => Icons.info_outline_rounded,
                        TileTone.green => Icons.check_circle_outline_rounded,
                        TileTone.amber => Icons.warning_amber_rounded,
                        TileTone.red => Icons.error_outline_rounded,
                        TileTone.neutral => Icons.notifications_none_rounded,
                      },
                  size: 17,
                  color: c.fg,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (title != null) ...[
                        Text(
                          title!,
                          style: AppText.rowTitle.copyWith(color: c.fg),
                        ),
                        const SizedBox(height: 2),
                      ],
                      Text(
                        message,
                        style: AppText.paragraph.copyWith(
                          color: AppColors.ink2,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                if (trailing != null) ...[const SizedBox(width: 8), trailing!],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// A section header: a title, and an optional right-hand link.
///
/// The mockup's `.shead`. Give it the link only when it goes somewhere the user
/// can recognise — "See all" pointing at a list they have already seen is
/// noise.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 0, 2, 8),
      child: Row(
        children: [
          Expanded(child: Text(title.toUpperCase(), style: AppText.eyebrowInk)),
          if (actionLabel != null && onAction != null)
            GestureDetector(
              onTap: onAction,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                padding: const EdgeInsets.only(left: 8, top: 2, bottom: 2),
                child: Text(actionLabel!, style: AppText.linkLabel),
              ),
            ),
        ],
      ),
    );
  }
}
