import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Shared bottom-navigation chrome, used by both the borrower and the lender
/// shell so the two can never drift apart again.
///
/// The active treatment is a 26×3 blue bar pinned to the *top* of the cell,
/// animated over 200ms. It sits above the icon rather than behind it so the
/// item's baseline grid stays identical whether it is active or not — the
/// labels of all items stay on one line, and nothing reflows when you switch
/// tabs.
///
/// Inactive ink is the lighter `0xFF9AA1B2` rather than `AppColors.muted`:
/// at 9.5px the darker grey reads as almost-active on a phone screen.
class AppNavItem extends StatelessWidget {
  const AppNavItem({
    super.key,
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  /// Bar height + its gap + icon + its gap + label line + trailing gap.
  /// The shell reserves exactly this much so items align across shells with
  /// different tab counts.
  static const double reservedHeight = 45;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.blue600 : const Color(0xFF9AA1B2);

    return Expanded(
      child: InkWell(
        onTap: onTap,
        // The bar animates in, but an invisible bar still has a 3px slot, so
        // the hit area stays the same size in both states.
        child: Semantics(
          button: true,
          selected: active,
          label: label,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                height: 3,
                width: active ? 26 : 0,
                decoration: const BoxDecoration(
                  color: AppColors.blue600,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(3),
                    bottomRight: Radius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Icon(icon, size: 20, color: color),
              const SizedBox(height: 3),
              Text(
                label,
                // Longest label across both shells is "Requests"; 9.5px keeps
                // it on one line next to a 20px icon in a 1/5-width cell.
                style: GoogleFonts.poppins(
                  fontSize: 9.5,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                  color: color,
                ),
                maxLines: 1,
                overflow: TextOverflow.clip,
                softWrap: false,
              ),
              const SizedBox(height: 4),
            ],
          ),
        ),
      ),
    );
  }
}

/// The white strip + hairline top border that both shells sit in.
class AppNavBar extends StatelessWidget {
  const AppNavBar({super.key, required this.children});

  final List<Widget> children;

  /// Tall enough for the reserved item height plus the home-indicator inset.
  static const double height = 62;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppColors.line)),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(height: height, child: Row(children: children)),
      ),
    );
  }
}
