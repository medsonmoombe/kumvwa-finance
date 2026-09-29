import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Bottom-nav shell for the CLIENT (borrower) experience.
///
/// Mirrors the mockup's `.nav` bar: a white strip with a hairline top border
/// and four compact items. The active icon sits inside a blue-50 pill while
/// its label remains aligned with the other labels.
class ClientShell extends StatelessWidget {
  const ClientShell({super.key, required this.shell});

  final StatefulNavigationShell shell;

  void _go(int index) =>
      shell.goBranch(index, initialLocation: index == shell.currentIndex);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: shell,
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(top: BorderSide(color: AppColors.line)),
        ),
        child: SafeArea(
          top: false,
          child: SizedBox(
            height: 62,
            child: Row(
              children: [
                _navItem(context, 0, Icons.home_rounded, 'Home'),
                _navItem(context, 1, Icons.assignment_rounded, 'History'),
                _navItem(context, 2, Icons.notifications_rounded, 'Alerts'),
                _navItem(context, 3, Icons.person_rounded, 'Profile'),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _navItem(
    BuildContext context,
    int index,
    IconData icon,
    String label,
  ) {
    final active = shell.currentIndex == index;
    final color = active ? AppColors.blue600 : const Color(0xFF9AA1B2);
    return Expanded(
      child: InkWell(
        onTap: () => _go(index),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top bar indicator — matches .nv.on::before in the HTML
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 3,
              width: active ? 26 : 0,
              decoration: BoxDecoration(
                color: AppColors.blue600,
                borderRadius: const BorderRadius.only(
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
              style: GoogleFonts.poppins(
                fontSize: 9.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w600,
                color: color,
              ),
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }
}
