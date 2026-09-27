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
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';
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
              // Human reference (LN-2026-00001) when the loan has one; the raw
              // id is only the fallback for loans that predate references.
              async.valueOrNull?.loanRef ?? loanId,
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
    // Contextual white-label — the lender's colors on THEIR header.
    final theme = lenderTheme(ref, loan.tenantId);

    // Rollover rows are extension FEES, not installments: they record the
    // deadline being moved, so they render in their own section instead of
    // turning "3 installments" into 5.
    final rollovers = loan.schedule.where((i) => i.rolloverFee).toList();
    final planned = loan.schedule.where((i) => !i.rolloverFee).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Container(
            padding: const EdgeInsets.fromLTRB(17, 15, 17, 15),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: theme.gradient,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        if (theme.logoUrl != null)
                          ClipOval(
                            child: Image.network(
                              theme.logoUrl!,
                              width: 24,
                              height: 24,
                              fit: BoxFit.cover,
                              errorBuilder: (_, _, _) =>
                                  const SizedBox.shrink(),
                            ),
                          )
                        else
                          Text(
                            Fmt.initials(loan.lenderName),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        const SizedBox(width: 7),
                        Text(
                          loan.lenderName,
                          style: const TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    switch (loan.status) {
                      LoanStatus.active => const AppBadge(
                        'Active',
                        variant: BadgeVariant.green,
                      ),
                      LoanStatus.overdue => const AppBadge(
                        'Overdue',
                        variant: BadgeVariant.red,
                      ),
                      LoanStatus.cleared => const AppBadge(
                        'Cleared',
                        variant: BadgeVariant.blue,
                      ),
                    },
                  ],
                ),
                const SizedBox(height: 8),
                // A settled loan leading with "Balance outstanding: K 0" is
                // true and emotionally flat — the cleared state gets its own
                // copy, matching the history card's "Repaid in full".
                Text(
                  loan.status == LoanStatus.cleared
                      ? 'Loan repaid'
                      : 'Balance outstanding',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFFAFC3EE),
                  ),
                ),
                AmountText(
                  loan.status == LoanStatus.cleared
                      ? loan.amountPaid
                      : loan.outstanding,
                  fontSize: 26,
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
                const SizedBox(height: 3),
                Text(
                  loan.status == LoanStatus.cleared
                      ? 'Fully settled · thank you'
                      : 'of ${Fmt.money(loan.totalDue)} total · '
                            '${loan.termInstallments} mo plan'
                            '${loan.rolloverCount > 0 ? ' · extended ${loan.rolloverCount}×' : ''}'
                            ' · ${loan.interestRatePct.toStringAsFixed(0)}%',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFFC6D4F2),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Repaid ${Fmt.money(loan.amountPaid)}',
                      style: const TextStyle(
                        fontSize: 10.5,
                        color: Color(0xFFAFC3EE),
                      ),
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
                        Container(color: Colors.white.withValues(alpha: .18)),
                        FractionallySizedBox(
                          widthFactor: loan.progress,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [AppColors.green500, Color(0xFF7FF0B0)],
                              ),
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
        // Never offer payment on a settled loan. Even with clean data this is
        // the guard that stops a "Cleared" header pairing with a pay button.
        if (loan.nextInstallment != null &&
            loan.status != LoanStatus.cleared &&
            loan.outstanding > 0)
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
              for (final inst in planned)
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
                                    color: AppColors.muted,
                                  ),
                                ),
                                if (inst.status != InstallmentStatus.paid) ...[
                                  const SizedBox(width: 6),
                                  DueChip(dueDate: inst.dueDate),
                                ],
                              ],
                            ),
                            // Accrued late penalty — shown in red so the
                            // borrower sees exactly why the balance grew.
                            if (inst.penalty > 0)
                              Text(
                                '+ penalty ${Fmt.money(inst.penalty, decimals: 2)}',
                                style: const TextStyle(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.red,
                                ),
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      AmountText(
                        inst.amount,
                        // 2 dp: the ngwee are what let a client add the
                        // schedule up and get the loan total back.
                        decimals: 2,
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
        // Extensions get their own ledger. A fee paid to move a deadline is a
        // different fact from "installment 4 of 3", so these rows never
        // inflate the plan above.
        if (rollovers.isNotEmpty) ...[
          const SizedBox(height: 11),
          SectionCard(
            title: 'Extensions (${rollovers.length})',
            child: Column(
              children: [for (final inst in rollovers) _extensionRow(inst)],
            ),
          ),
        ],
      ],
    );
  }

  /// One rollover: the fee paid to move a deadline — NOT an installment.
  Widget _extensionRow(Installment inst) {
    final paid = inst.status == InstallmentStatus.paid;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 31,
            height: 31,
            decoration: BoxDecoration(
              color: paid ? AppColors.green50 : AppColors.blue50,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              paid ? Icons.check_rounded : Icons.update_rounded,
              size: 15,
              color: paid ? AppColors.green700 : AppColors.blue600,
            ),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Extension · ${paid ? 'Paid' : 'Pending'}',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                Text(
                  'Deadline moved to ${Fmt.date(inst.dueDate)}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          AmountText(
            inst.amount,
            decimals: 2,
            fontSize: 12,
            color: paid ? AppColors.green700 : AppColors.ink,
          ),
        ],
      ),
    );
  }
}
