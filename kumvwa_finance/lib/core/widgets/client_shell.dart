import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/widgets/nav_bar.dart';

/// Bottom-nav shell for the CLIENT (borrower) experience.
///
/// Four compact items. The active treatment lives in [AppNavItem], which is
/// shared with the lender shell so both surfaces stay identical.
class ClientShell extends StatelessWidget {
  const ClientShell({super.key, required this.shell});

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
          _item(context, 1, Icons.assignment_rounded, 'History'),
          _item(context, 2, Icons.notifications_rounded, 'Alerts'),
          _item(context, 3, Icons.person_rounded, 'Profile'),
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
