import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// One destination in an [ActionGrid].
///
/// [tone] decides the circle's fill: blue for the standard action, green for the
/// one the screen most wants pressed. Use green once per grid — two green
/// circles means neither is the primary.
class AppAction {
  const AppAction({
    required this.id,
    required this.label,
    required this.icon,
    this.tone = ActionTone.blue,
  });

  final String id;
  final String label;
  final IconData icon;
  final ActionTone tone;
}

enum ActionTone { blue, green }

/// The home screen's circular action grid — four across.
///
/// The mockup's answer to "what can I do here": a fixed, scannable block of
/// destinations directly under the hero, rather than a scrolling menu the user
/// has to hunt. Order is the reading order, so put the one action that matters
/// most for the current state first.
class ActionGrid extends StatelessWidget {
  const ActionGrid({
    super.key,
    required this.actions,
    required this.onTap,
    this.columns = 4,
  });

  final List<AppAction> actions;
  final void Function(String id) onTap;
  final int columns;

  @override
  Widget build(BuildContext context) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(2, 14, 2, 2),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: columns,
        mainAxisSpacing: 14,
        crossAxisSpacing: 4,
        // Circle plus its label, in the mockup's proportions.
        childAspectRatio: 50 / 74,
      ),
      itemCount: actions.length,
      itemBuilder: (context, i) {
        final a = actions[i];
        return _ActionCell(action: a, onTap: () => onTap(a.id));
      },
    );
  }
}

class _ActionCell extends StatefulWidget {
  const _ActionCell({required this.action, required this.onTap});

  final AppAction action;
  final VoidCallback onTap;

  @override
  State<_ActionCell> createState() => _ActionCellState();
}

class _ActionCellState extends State<_ActionCell> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final green = widget.action.tone == ActionTone.green;
    return Semantics(
      button: true,
      label: widget.action.label,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _down = true),
        onTapUp: (_) => setState(() => _down = false),
        onTapCancel: () => setState(() => _down = false),
        onTap: widget.onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedScale(
              scale: _down ? 0.9 : 1,
              duration: const Duration(milliseconds: 120),
              child: Container(
                width: AppSizes.actionCircle,
                height: AppSizes.actionCircle,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: green
                      ? AppGradients.green
                      : const LinearGradient(
                          colors: [AppColors.blue500, AppColors.blue500],
                        ),
                  boxShadow: green
                      ? AppShadows.shActionGreen
                      : AppShadows.shAction,
                ),
                child: Icon(widget.action.icon, size: 20, color: Colors.white),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.action.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.navLabel.copyWith(color: AppColors.ink2),
            ),
          ],
        ),
      ),
    );
  }
}
