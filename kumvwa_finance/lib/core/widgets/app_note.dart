import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Amber callout with a warning icon. Pass [child] for rich text
/// (e.g. bold segments inside the message).
class AppNote extends StatelessWidget {
  const AppNote({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.amber50,
        border: Border.all(color: const Color(0xFFF3DCB3)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: const Color(0xFFFCE9C4),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.warning_amber_rounded,
              size: 16,
              color: Color(0xFFB26A00),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 5),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}
