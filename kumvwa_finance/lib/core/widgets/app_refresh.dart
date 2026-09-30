import 'package:flutter/material.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Wraps any scrollable child with a branded [RefreshIndicator].
///
/// Usage:
///   AppRefresh(onRefresh: _load, child: ListView(...))
///
/// The child MUST have [AlwaysScrollableScrollPhysics] (or equivalent) so
/// the pull gesture registers even when the list is shorter than the screen.
class AppRefresh extends StatelessWidget {
  const AppRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
  });

  final Future<void> Function() onRefresh;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.blue600,
      backgroundColor: Colors.white,
      strokeWidth: 2.5,
      child: child,
    );
  }
}
