import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// One destination in an [AppNav].
///
/// [icon] is drawn at 22dp. Where a destination has both a filled and an
/// outlined form (Home, Alerts) pass the outlined one — the active tile's blue
/// fill is the whole emphasis, and a second weight change fights it.
class AppNavItem {
  const AppNavItem({required this.id, required this.label, required this.icon});

  final String id;
  final String label;
  final IconData icon;
}

/// The bottom navigation: a lifted white bar with a blue dot marking the
/// current tab.
///
/// The dot, not a filled pill, is the active indicator — it is the mockup's
/// answer to the problem that a 5-item bar has no room for active fills. The
/// tint behind the active icon is only a nudge.
///
/// Place this OUTSIDE the scroll view, not inside it, and pad the scrolling
/// body by [AppInsets.navGutter] so the last row clears the bar.
class AppNav extends StatelessWidget {
  const AppNav({
    super.key,
    required this.items,
    required this.activeId,
    required this.onTap,
  });

  final List<AppNavItem> items;
  final String activeId;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        border: Border(top: BorderSide(color: AppColors.line2, width: 1)),
        boxShadow: AppShadows.shNav,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
        child: SafeArea(
          top: false,
          child: Row(
            children: [
              for (final item in items)
                Expanded(
                  child: _NavButton(
                    item: item,
                    selected: item.id == activeId,
                    onTap: () => onTap(item.id),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final AppNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: item.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 34,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: selected ? AppColors.blue50 : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(
                  item.icon,
                  size: 22,
                  color: selected ? AppColors.blue500 : AppColors.muted,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppText.navLabel.copyWith(
                  color: selected ? AppColors.ink : AppColors.muted,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
              const SizedBox(height: 4),
              // The active marker. Kept at a fixed size so inactive items don't
              // shift when it appears.
              SizedBox(
                width: 3,
                height: 3,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: selected ? AppColors.blue500 : Colors.transparent,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
