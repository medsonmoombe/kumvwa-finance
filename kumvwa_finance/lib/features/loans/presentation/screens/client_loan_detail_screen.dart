import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/due_chip.dart';
import 'package:kumvwa_finance/core/widgets/section_card.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/pay_sheet.dart';

class ClientLoanDetailScreen extends ConsumerWidget {
  const ClientLoanDetailScreen({super.key, required this.loanId});

  final String loanId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loanByIdProvider(loanId));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loan'),
            Text(
              loanId,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w400,
                color: AppColors.muted,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                Skeleton(width: double.infinity, height: 140, radius: 20),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 190, radius: 16),
              ],
            ),
          ),
          error: (_, _) => const Center(child: Text('Loan not found')),
          data: (loan) => _Body(loan: loan),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.fromLTRB(17, 15, 17, 15),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.blue600, AppColors.blue900],
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      loan.lenderName,
                      style: const TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                    switch (loan.status) {
                      LoanStatus.active =>
                        const AppBadge('Active', variant: BadgeVariant.green),
                      LoanStatus.overdue =>
                        const AppBadge('Overdue', variant: BadgeVariant.red),
                      LoanStatus.cleared =>
                        const AppBadge('Cleared', variant: BadgeVariant.blue),
                    },
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Balance outstanding',
                  style:
                      TextStyle(fontSize: 11, color: Color(0xFFAFC3EE)),
                ),
                AmountText(
                  loan.outstanding,
                  fontSize: 26,
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
                const SizedBox(height: 3),
                Text(
                  'of ${Fmt.money(loan.totalDue)} total · '
                  '${loan.termInstallments} mo · '
                  '${loan.interestRatePct.toStringAsFixed(0)}%',
                  style:
                      const TextStyle(fontSize: 11, color: Color(0xFFC6D4F2)),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Repaid ${Fmt.money(loan.amountPaid)}',
                      style: const TextStyle(
                          fontSize: 10.5, color: Color(0xFFAFC3EE)),
                    ),
                    Text(
                      '${(loan.progress * 100).toStringAsFixed(0)}%',
                      style: const TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF7FF0B0),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: SizedBox(
                    height: 6,
                    child: Stack(
                      children: [
                        Container(
                            color: Colors.white.withValues(alpha: .18)),
                        FractionallySizedBox(
                          widthFactor: loan.progress,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(colors: [
                                AppColors.green500,
                                Color(0xFF7FF0B0),
                              ]),
                              borderRadius: BorderRadius.circular(99),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 11),
        if (loan.nextInstallment != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 11),
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.green500,
                minimumSize: const Size.fromHeight(50),
              ),
              onPressed: () => showPaySheet(context, ref, loan),
              child: Text(
                'Pay ${Fmt.money(loan.nextInstallment!.amount, decimals: 2)}'
                ' · ${loan.daysUntilDue! < 0 ? 'overdue' : 'due in ${loan.daysUntilDue} days'}',
              ),
            ),
          ),
        SectionCard(
          title: 'Repayment Schedule',
          child: Column(
            children: [
              for (final inst in loan.schedule)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Container(
                        width: 31,
                        height: 31,
                        decoration: BoxDecoration(
                          color: inst.status == InstallmentStatus.paid
                              ? AppColors.green50
                              : inst.status == InstallmentStatus.overdue
                                  ? AppColors.red50
                                  : AppColors.blue50,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          inst.status == InstallmentStatus.paid
                              ? Icons.check
                              : Icons.schedule,
                          size: 15,
                          color: inst.status == InstallmentStatus.paid
                              ? AppColors.green700
                              : inst.status == InstallmentStatus.overdue
                                  ? AppColors.red
                                  : AppColors.blue600,
                        ),
                      ),
                      const SizedBox(width: 11),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Installment ${inst.number} · '
                              '${switch (inst.status) {
                                InstallmentStatus.paid => 'Paid',
                                InstallmentStatus.due => 'Due',
                                InstallmentStatus.overdue => 'Overdue',
                                InstallmentStatus.upcoming => 'Upcoming',
                              }}',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.ink,
                              ),
                            ),
                            Row(
                              children: [
                                Text(
                                  Fmt.date(inst.dueDate),
                                  style: const TextStyle(
                                      fontSize: 10.5,
                                      color: AppColors.muted),
                                ),
                                if (inst.status !=
                                    InstallmentStatus.paid) ...[
                                  const SizedBox(width: 6),
                                  DueChip(dueDate: inst.dueDate),
                                ],
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      AmountText(
                        inst.amount,
                        fontSize: 12,
                        color: inst.status == InstallmentStatus.paid
                            ? AppColors.green700
                            : AppColors.ink,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
