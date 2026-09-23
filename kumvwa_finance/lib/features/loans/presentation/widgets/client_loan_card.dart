import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/due_chip.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

/// Borrower-facing loan card used on the client home and loan history.
/// Tap anywhere → full loan detail (repayment schedule).
class ClientLoanCard extends StatelessWidget {
  const ClientLoanCard({super.key, required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/c/loan/${loan.id}'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.blue500, AppColors.blue900],
                ),
                shape: BoxShape.circle,
              ),
              child: Text(
                Fmt.initials(loan.lenderName),
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    loan.lenderName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Balance ${Fmt.money(loan.outstanding)} '
                    'of ${Fmt.money(loan.totalDue)}',
                    style: const TextStyle(
                        fontSize: 10.5, color: AppColors.muted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (loan.nextInstallment != null)
                  DueChip(dueDate: loan.nextInstallment!.dueDate)
                else
                  const AppBadge('Cleared', variant: BadgeVariant.green),
                const SizedBox(height: 4),
                Text(
                  '${(loan.progress * 100).toStringAsFixed(0)}% repaid',
                  style: const TextStyle(
                      fontSize: 9.5, color: AppColors.muted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}