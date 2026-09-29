import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// Shared domed gradient header for all client screens (History, Alerts,
/// Profile). Matches the Home dome visual language: brand gradient, two
/// decorative blobs, elliptical bottom corners.
///
/// Pass [title], optional [subtitle], optional [trailing] widget (e.g. a
/// "Mark all read" link), and optional [onBack] for screens that need a back
/// button.
class ClientDomeHeader extends StatelessWidget {
  const ClientDomeHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onBack,
    this.bottom,
  });

  final String title;
  final String? subtitle;

  /// Right-hand widget in the title row (e.g. a text link).
  final Widget? trailing;

  /// If provided, a circular back button is shown above the title.
  final VoidCallback? onBack;

  /// Extra widget rendered below the title block (e.g. a segmented control).
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppGradients.dome),
      child: Stack(
        children: [
                // blob 1
                Positioned(
                  right: -60,
                  top: -90,
                  child: Container(
                    width: 190,
                    height: 190,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.09),
                    ),
                  ),
                ),
                // blob 2
                Positioned(
                  left: -44,
                  bottom: -30,
                  child: Container(
                    width: 130,
                    height: 130,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.07),
                    ),
                  ),
                ),
          Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              14,
              18,
              bottom != null ? 48 : 22,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                      if (onBack != null) ...[
                        _BackButton(onTap: onBack!),
                        const SizedBox(height: 8),
                      ],
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(title, style: AppText.domeTitle),
                                if (subtitle != null) ...[
                                  const SizedBox(height: 3),
                                  Text(
                                    subtitle!,
                                    style: AppText.sheetSub.copyWith(
                                      color: AppColors.onGradientSub,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          if (trailing != null) ...[
                            const SizedBox(width: 8),
                            trailing!,
                          ],
                        ],
                      ),
                      if (bottom != null) ...[
                        const SizedBox(height: 12),
                        bottom!,
                      ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: 0.16),
        ),
        child: const Icon(
          Icons.chevron_left_rounded,
          size: 22,
          color: Colors.white,
        ),
      ),
    );
  }
}
