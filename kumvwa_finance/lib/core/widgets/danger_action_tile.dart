import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';

/// A deliberate, hard-to-reach destructive action.
///
/// Signing out is not a peer of the informational rows above it, so it is
/// rendered as its own clearly-labelled block outside the settings-list flow
/// rather than as another tappable line. It is outlined rather than filled:
/// red is reserved for the consequence, not the button, which keeps it from
/// competing with the primary action it sits beneath.
///
/// Both the client and the lender use this, so the two profiles can't drift
/// apart again — the lender copy previously had no confirmation at all.
class DangerActionTile extends ConsumerWidget {
  const DangerActionTile({
    required this.label,
    required this.onConfirm,
    this.description,
    this.icon = Icons.logout_rounded,
    this.confirmTitle,
    this.confirmBody,
    super.key,
  });

  final String label;
  final String? description;
  final IconData icon;

  /// Runs only after the user confirms.
  final Future<void> Function() onConfirm;

  final String? confirmTitle;
  final String? confirmBody;

  Future<void> _run(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(confirmTitle ?? 'Sign out?'),
        content: Text(
          confirmBody ??
              'You will need to sign in again to access your account.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.red,
              backgroundColor: AppColors.red50,
            ),
            child: Text(label),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    // A destructive action should feel like one. The haptic is cosmetic, so it is
    // deliberately not awaited.
    HapticFeedback.mediumImpact().ignore();
    await onConfirm();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // No extra Semantics wrapper: InkWell already publishes a button node whose
// label comes from the text below, and a second node would double-announce.
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _run(context, ref),
        borderRadius: BorderRadius.circular(14),
        child: Ink(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.redLine),
          ),
          child: Row(
            children: [
              Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.red50,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 17, color: AppColors.red),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      label,
                      style: AppText.rowTitle.copyWith(
                        color: AppColors.redInk,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (description != null) ...[
                      const SizedBox(height: 2),
                      Text(description!, style: AppText.fine),
                    ],
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: AppColors.redLine,
              ),
            ],
          ),
        ),
      ),
    );
  }
}