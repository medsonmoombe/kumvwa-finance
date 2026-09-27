import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/lender_avatar.dart';

/// Loan request row — used on both sides.
/// [titleName] is the counterparty: client name (lender viewing)
/// or lender name (client viewing).
///
/// Reads top-down: who it went to and where it stands, how much was asked
/// for, why, then when it was sent.
class LoanRequestCard extends ConsumerWidget {
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
  Widget build(BuildContext context, WidgetRef ref) {
    // The counterparty on a borrower's request IS a lender — brand their
    // identity rather than showing a generic Kumvwa-blue sticker.
    final theme = lenderTheme(ref, request.lenderId);
    final declined =
        request.status == LoanRequestStatus.rejected &&
        request.feedback != null;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LenderAvatar(theme: theme, name: titleName),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        titleName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      // A lone line, so a long name or a big amount degrades by
                      // ellipsis instead of overflowing the row.
                      AmountText(
                        request.amount,
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                StatusTag(
                  request.status.label,
                  variant: switch (request.status) {
                    LoanRequestStatus.pending => BadgeVariant.amber,
                    LoanRequestStatus.approved => BadgeVariant.green,
                    LoanRequestStatus.rejected => BadgeVariant.red,
                  },
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              request.purpose,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppText.subText.copyWith(
                color: AppColors.ink2,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 9),
            Row(
              children: [
                // Not a clock: on loan cards a clock means "due", and this
                // is the day the application went out, not a deadline. A
                // plain document mark keeps it neutral — no implied urgency.
                const Icon(
                  Icons.description_outlined,
                  size: 15,
                  color: AppColors.muted,
                ),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    'Requested ${Fmt.date(request.requestedAt)} · '
                    '${request.termInstallments} '
                    'installment${request.termInstallments == 1 ? '' : 's'}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.caption,
                  ),
                ),
              ],
            ),
            if (declined) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: AppColors.red50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFF3C6C8)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.info_outline,
                      size: 15,
                      color: Color(0xFFC03538),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Lender feedback',
                            style: AppText.caption.copyWith(
                              color: const Color(0xFFC03538),
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            request.feedback!,
                            style: AppText.caption.copyWith(
                              color: const Color(0xFFC03538),
                              fontWeight: FontWeight.w500,
                              height: 1.45,
                            ),
                          ),
                        ],
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
