import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/lender_avatar.dart';

/// Borrower-facing loan card (client home + history).
///
/// One hierarchy, four quiet lines, a single status tag:
///
///   who lent it · state → what's left → how far along → what happens next
///
/// The balance used to arrive unannounced ("K 523 of K 569" when the client
/// asked for K 455), so the principal now sits on the same line as the
/// balance. Nothing here renders below [AppText.caption].
class ClientLoanCard extends ConsumerWidget {
  const ClientLoanCard({super.key, required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = lenderTheme(ref, loan.tenantId);
    final (IconData icon, String dueText, Color dueColor) = _dueLine(loan);

    return GestureDetector(
      onTap: () => context.push('/c/loan/${loan.id}'),
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LenderAvatar(theme: theme, name: loan.lenderName),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          loan.lenderName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.body.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      StatusTag(
                        _statusLabel(loan.status),
                        variant: _statusVariant(loan.status),
                      ),
                    ],
                  ),
                  const SizedBox(height: 5),
                  // "Why do I owe 569 when I borrowed 455?" — answered here
                  // rather than left to be worked out.
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      // Both runs are flexible so the row degrades by ellipsis
                      // (caption first) rather than by overflowing, which is
                      // what happens under large system text scaling.
                      Flexible(
                        flex: 3,
                        child: AmountText(
                          loan.outstanding,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        flex: 2,
                        child: Text(
                          'of ${Fmt.money(loan.totalDue)} · '
                          'borrowed ${Fmt.money(loan.principal)}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.caption,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 9),
                  _ProgressBar(progress: loan.progress),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Icon(icon, size: 15, color: dueColor),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          dueText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.caption.copyWith(color: dueColor),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _statusLabel(LoanStatus status) => switch (status) {
    LoanStatus.active => 'Active',
    LoanStatus.overdue => 'Overdue',
    LoanStatus.cleared => 'Cleared',
  };

  static BadgeVariant _statusVariant(LoanStatus status) => switch (status) {
    LoanStatus.active => BadgeVariant.green,
    LoanStatus.overdue => BadgeVariant.red,
    LoanStatus.cleared => BadgeVariant.blue,
  };

  /// The card's one piece of "what now?" information, as an icon + line
  /// instead of a coloured chip.
  static (IconData, String, Color) _dueLine(Loan loan) {
    final next = loan.nextInstallment;
    if (next == null) {
      return (Icons.verified_outlined, 'Repaid in full', AppColors.green700);
    }

    final days = loan.daysUntilDue ?? 0;
    if (days < 0) {
      final overdue = -days;
      return (
        Icons.error_outline,
        '${Fmt.date(next.dueDate)} · '
            '$overdue day${overdue == 1 ? '' : 's'} overdue',
        AppColors.red,
      );
    }
    if (days == 0) {
      return (
        Icons.schedule,
        '${Fmt.date(next.dueDate)} · due today',
        const Color(0xFFB26A00),
      );
    }
    if (days == 1) {
      return (
        Icons.schedule,
        '${Fmt.date(next.dueDate)} · due tomorrow',
        const Color(0xFFB26A00),
      );
    }
    return (
      Icons.event_outlined,
      'Next ${Fmt.date(next.dueDate)} · in $days days',
      AppColors.muted,
    );
  }
}

/// Repayment progress. A bar says "how far along am I" faster than any label,
/// so it replaces the old percentage chip.
class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(99),
      child: SizedBox(
        height: 5,
        child: Stack(
          children: [
            Container(color: AppColors.line),
            FractionallySizedBox(
              widthFactor: progress.clamp(0.0, 1.0),
              child: Container(color: AppColors.green500),
            ),
          ],
        ),
      ),
    );
  }
}
