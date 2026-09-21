import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/risk_gauge.dart';
import 'package:kumvwa_finance/core/widgets/section_card.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

class LoanDetailScreen extends ConsumerWidget {
  const LoanDetailScreen({super.key, required this.loanId});

  final String loanId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loanByIdProvider(loanId));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loan Detail'),
            Text(loanId, style: AppText.subText),
          ],
        ),
        actions: [
          if (async.valueOrNull != null)
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(
                child: switch (async.valueOrNull!.status) {
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
              ),
            ),
        ],
      ),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                Skeleton(width: double.infinity, height: 132, radius: 20),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 96, radius: 16),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 190, radius: 16),
              ],
            ),
          ),
          error: (_, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 44,
                  color: AppColors.muted,
                ),
                const SizedBox(height: 14),
                const Text('Loan not found'),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.invalidate(loanByIdProvider(loanId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (loan) => _Body(loan: loan),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        // ---------- summary ----------
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
                      'Principal',
                      style: AppText.subText.copyWith(
                        color: const Color(0xFFAFC3EE),
                      ),
                    ),
                    Text(
                      'Business loan · '
                      '${loan.interestRatePct.toStringAsFixed(0)}% · '
                      '${loan.termInstallments} mo',
                      style: AppText.subText.copyWith(
                        color: const Color(0xFFAFC3EE),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                AmountText(
                  loan.principal,
                  fontSize: 26,
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
                const SizedBox(height: 3),
                Text(
                  '${loan.clientName} · NRC ${loan.nrc}',
                  style: AppText.subText.copyWith(
                    color: const Color(0xFFC6D4F2),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Repaid ${Fmt.money(loan.amountPaid)} of '
                      '${Fmt.money(loan.totalDue)}',
                      style: AppText.subText.copyWith(
                        color: const Color(0xFFAFC3EE),
                      ),
                    ),
                    Text(
                      '${(loan.progress * 100).toStringAsFixed(0)}%',
                      style: AppText.subText.copyWith(
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF7FF0B0),
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
                          color: Colors.white.withValues(alpha: .18),
                        ),
                        FractionallySizedBox(
                          widthFactor: loan.progress,
                          child: Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [
                                  AppColors.green500,
                                  Color(0xFF7FF0B0),
                                ],
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
        // ---------- risk panel ----------
        if (loan.risk != null)
          SectionCard(
            title: 'Credit Risk Score',
            child: Row(
              children: [
                Column(
                  children: [
                    RiskGauge(score: loan.risk!.score),
                    const SizedBox(height: 4),
                    const SizedBox(
                      width: 104,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('300', style: AppText.caption),
                          Text('850', style: AppText.caption),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      switch (loan.risk!.band) {
                        RiskLevel.low => const AppBadge(
                          'Low Risk',
                          variant: BadgeVariant.green,
                        ),
                        RiskLevel.medium => const AppBadge(
                          'Medium Risk',
                          variant: BadgeVariant.amber,
                        ),
                        RiskLevel.high => const AppBadge(
                          'High Risk',
                          variant: BadgeVariant.red,
                        ),
                      },
                      const SizedBox(height: 7),
                      Text(
                        'Source: ${loan.risk!.source}\n'
                        'Checked ${Fmt.date(loan.risk!.checkedAt)} · '
                        'NRC matched',
                        style: AppText.subText.copyWith(height: 1.55),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(13),
            decoration: BoxDecoration(
              color: AppColors.blue50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFB9C6E8)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.info_outline,
                  size: 18,
                  color: AppColors.blue600,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'No credit check yet. Consent must be given by the client '
                    'before a bureau check can be run.',
                    style: AppText.subText.copyWith(
                      color: AppColors.blue600,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 11),
        // ---------- schedule ----------
        SectionCard(
          title: 'Repayment Schedule',
          child: Column(
            children: [
              for (final inst in loan.schedule)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      _InstallmentIcon(status: inst.status),
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
                              style: AppText.body.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              Fmt.date(inst.dueDate),
                              style: AppText.subText,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      AmountText(
                        inst.amount,
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

class _InstallmentIcon extends StatelessWidget {
  const _InstallmentIcon({required this.status});

  final InstallmentStatus status;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, IconData icon) = switch (status) {
      InstallmentStatus.paid => (
        AppColors.green50,
        AppColors.green700,
        Icons.check,
      ),
      InstallmentStatus.due => (
        AppColors.blue50,
        AppColors.blue600,
        Icons.schedule,
      ),
      InstallmentStatus.overdue => (
        AppColors.red50,
        AppColors.red,
        Icons.priority_high,
      ),
      InstallmentStatus.upcoming => (
        const Color(0xFFF0F2F7),
        AppColors.muted,
        Icons.schedule,
      ),
    };

    return Container(
      width: 31,
      height: 31,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, size: 15, color: fg),
    );
  }
}
