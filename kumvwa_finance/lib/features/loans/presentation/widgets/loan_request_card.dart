import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';

/// Loan request row — used on both sides.
/// [titleName] is the counterparty: client name (lender viewing)
/// or lender name (client viewing).
class LoanRequestCard extends StatelessWidget {
  const LoanRequestCard({
    super.key,
    required this.request,
    required this.titleName,
    this.onTap,
  });

  final LoanRequest request;
  final String titleName;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final badge = switch (request.status) {
      LoanRequestStatus.pending =>
        const AppBadge('Pending', variant: BadgeVariant.amber),
      LoanRequestStatus.approved =>
        const AppBadge('Approved', variant: BadgeVariant.green),
      LoanRequestStatus.rejected =>
        const AppBadge('Declined', variant: BadgeVariant.red),
    };

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
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
                    Fmt.initials(titleName),
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
                        titleName,
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
                        '${Fmt.money(request.amount)} · '
                        '${request.termInstallments} mo · '
                        '${Fmt.date(request.requestedAt)}',
                        style: const TextStyle(
                            fontSize: 10.5, color: AppColors.muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                badge,
              ],
            ),
            const SizedBox(height: 8),
            Text(
              request.purpose,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.ink2,
                height: 1.4,
              ),
            ),
            if (request.status == LoanRequestStatus.rejected &&
                request.feedback != null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.red50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFF3C6C8)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Lender feedback',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFFC03538),
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      request.feedback!,
                      style: const TextStyle(
                        fontSize: 11.5,
                        color: Color(0xFFC03538),
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
