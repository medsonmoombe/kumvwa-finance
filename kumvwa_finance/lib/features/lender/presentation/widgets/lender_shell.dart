import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/widgets/nav_bar.dart';

/// Bottom-nav shell for the LENDER experience.
///
/// Five items, same chrome and same active treatment as [ClientShell] — the
/// bar height, indicator shape, icon size and label size all come from
/// [AppNavBar] / [AppNavItem] so the two surfaces cannot drift apart.
class LenderShell extends StatelessWidget {
  const LenderShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _go(int index) =>
      shell.goBranch(index, initialLocation: index == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: AppNavBar(
        children: [
          _item(context, 0, Icons.home_rounded, 'Home'),
          _item(context, 1, Icons.people_rounded, 'Clients'),
          _item(context, 2, Icons.assignment_rounded, 'Requests'),
          _item(context, 3, Icons.notifications_rounded, 'Alerts'),
          _item(context, 4, Icons.business_rounded, 'Profile'),
        ],
      ),
    );
  }

  Widget _item(
    BuildContext context,
    int index,
    IconData icon,
    String label,
  ) => AppNavItem(
    icon: icon,
    label: label,
    active: shell.currentIndex == index,
    onTap: () => _go(index),
  );
}
