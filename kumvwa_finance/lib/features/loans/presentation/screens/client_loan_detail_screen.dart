import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/due_chip.dart';
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
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: async.when(
          loading: () => const _LoadingSkeleton(),
          error: (_, _) => const Center(child: Text('Loan not found')),
          data: (loan) => _DetailScaffold(loan: loan),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scaffold: dome header + scrolling body
// ─────────────────────────────────────────────────────────────────────────────

class _DetailScaffold extends ConsumerWidget {
  const _DetailScaffold({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isActive = loan.status != LoanStatus.cleared;

    return ListView(
      padding: EdgeInsets.zero,
      children: [
        DomeHeader(
          small: true,
          child: DomeTitle(
            title: loan.lenderName,
            subtitle: '${loan.loanRef ?? loan.id} · ${loan.termInstallments} months',
            onBack: () => context.pop(),
            trailing: _StatusChip(status: loan.status),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            AppInsets.page,
            14,
            AppInsets.page,
            AppInsets.aboveNav,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _AmountBox(loan: loan),
              const SizedBox(height: 11),
              if (isActive &&
                  loan.nextInstallment != null &&
                  loan.outstanding > 0)
                Padding(
                  padding: const EdgeInsets.only(bottom: 11),
                  child: AppButton(
                    tone: AppButtonTone.green,
                    label: 'Repay now · '
                        '${Fmt.money(loan.nextInstallment!.remaining, decimals: 2)}'
                        ' due in ${loan.daysUntilDue ?? 0} days',
                    onPressed: () => showPaySheet(context, ref, loan),
                  ),
                ),
              _ScheduleCard(loan: loan),
              if (loan.rolloverCount > 0) ...[
                const SizedBox(height: 11),
                _ExtensionsCard(loan: loan),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount box — matches HTML .amtbox with progress bar
// ─────────────────────────────────────────────────────────────────────────────

class _AmountBox extends StatelessWidget {
  const _AmountBox({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    final isCleared = loan.status == LoanStatus.cleared;
    final displayAmount = isCleared ? loan.amountPaid : loan.outstanding;

    return Container(
      padding: const EdgeInsets.fromLTRB(15, 13, 15, 15),
      decoration: BoxDecoration(
        color: AppColors.blue50,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.blueLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label — matches HTML .amtbox span
          Text(
            (isCleared ? 'Total repaid' : 'Balance outstanding').toUpperCase(),
            style: AppText.eyebrowTiny,
          ),
          const SizedBox(height: 4),
          // Big figure — matches HTML .amtbox b
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: 'K ',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: AppColors.blue900.withValues(alpha: 0.7),
                    fontFeatures: AppText.tabular,
                  ),
                ),
                TextSpan(
                  text: NumberFormat.decimalPattern()
                      .format(displayAmount),
                  style: GoogleFonts.poppins(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: AppColors.blue900,
                    fontFeatures: AppText.tabular,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 4),
          // Sub-line
          Text(
            isCleared
                ? 'Fully settled · thank you'
                : 'of ${Fmt.money(loan.totalDue)} total · '
                    '${loan.termInstallments} mo plan'
                    '${loan.rolloverCount > 0 ? ' · extended ${loan.rolloverCount}×' : ''}'
                    ' · ${loan.interestRatePct.toStringAsFixed(0)}%/mo',
            style: AppText.rowSub.copyWith(color: AppColors.blue600),
          ),
          const SizedBox(height: 12),
          // Progress row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Repaid ${Fmt.money(loan.amountPaid)}',
                style: AppText.rowSub,
              ),
              Text(
                '${(loan.progress * 100).toStringAsFixed(0)}%',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.green700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: SizedBox(
              height: 6,
              child: Stack(
                children: [
                  Container(color: AppColors.blueLine),
                  FractionallySizedBox(
                    widthFactor: loan.progress.clamp(0.0, 1.0),
                    child: Container(
                      decoration: BoxDecoration(
                        gradient: AppGradients.green,
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
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Schedule card — matches HTML .trow pattern inside a SectionCard
// ─────────────────────────────────────────────────────────────────────────────

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    final planned = loan.schedule.where((i) => !i.rolloverFee).toList();

    return Container(
      padding: const EdgeInsets.fromLTRB(15, 13, 15, 4),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Repayment Schedule', style: AppText.sectionTitle),
          const SizedBox(height: 8),
          for (final inst in planned)
            _ScheduleRow(inst: inst, isLast: inst == planned.last),
        ],
      ),
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({required this.inst, required this.isLast});

  final Installment inst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final isPaid = inst.status == InstallmentStatus.paid;
    final isOverdue = inst.status == InstallmentStatus.overdue;

    // Icon tile colors — matches HTML .tico .t-g / .t-r / .t-b
    final (Color tileBg, Color tileFg) = isPaid
        ? (AppColors.green50, AppColors.green700)
        : isOverdue
        ? (AppColors.red50, AppColors.redInk)
        : (AppColors.blue50, AppColors.blue600);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              // Circular icon tile — matches HTML .tico
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: tileBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPaid ? Icons.check_rounded : Icons.schedule_rounded,
                  size: 16,
                  color: tileFg,
                ),
              ),
              const SizedBox(width: 11),
              // Title + sub — matches HTML .tr-m
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
                      style: AppText.rowTitle,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(Fmt.date(inst.dueDate), style: AppText.rowSub),
                        if (inst.status != InstallmentStatus.paid) ...[
                          const SizedBox(width: 6),
                          DueChip(dueDate: inst.dueDate),
                        ],
                      ],
                    ),
                    if (inst.penalty > 0)
                      Text(
                        '+ penalty ${Fmt.money(inst.penalty, decimals: 2)}',
                        style: const TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.redInk,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Amount — matches HTML .amt
              Text(
                Fmt.money(inst.remaining, decimals: 2),
                style: AppText.rowAmount.copyWith(
                  color: isPaid ? AppColors.green700 : AppColors.blue600,
                ),
              ),
            ],
          ),
        ),
        if (!isLast)
          const Divider(height: 1, color: AppColors.line2),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Extensions card — rollover fees in their own section
// ─────────────────────────────────────────────────────────────────────────────

class _ExtensionsCard extends StatelessWidget {
  const _ExtensionsCard({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context) {
    final rollovers = loan.schedule.where((i) => i.rolloverFee).toList();

    return Container(
      padding: const EdgeInsets.fromLTRB(15, 13, 15, 4),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Extensions (${loan.rolloverCount})', style: AppText.sectionTitle),
          const SizedBox(height: 8),
          if (rollovers.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                'Interest was paid to extend this bullet-loan maturity. The updated due date is shown in the repayment schedule.',
                style: AppText.rowSub,
              ),
            )
          else
            for (final inst in rollovers)
              _ExtensionRow(inst: inst, isLast: inst == rollovers.last),
        ],
      ),
    );
  }
}

class _ExtensionRow extends StatelessWidget {
  const _ExtensionRow({required this.inst, required this.isLast});

  final Installment inst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final isPaid = inst.status == InstallmentStatus.paid;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: isPaid ? AppColors.green50 : AppColors.amber50,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  isPaid ? Icons.check_rounded : Icons.update_rounded,
                  size: 16,
                  color: isPaid ? AppColors.green700 : AppColors.amberInk,
                ),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Extension · ${isPaid ? 'Paid' : 'Pending'}',
                      style: AppText.rowTitle,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Deadline moved to ${Fmt.date(inst.dueDate)}',
                      style: AppText.rowSub,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                Fmt.money(inst.amount, decimals: 2),
                style: AppText.rowAmount.copyWith(
                  color: isPaid ? AppColors.green700 : AppColors.blue600,
                ),
              ),
            ],
          ),
        ),
        if (!isLast)
          const Divider(height: 1, color: AppColors.line2),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status chip — matches HTML .chip
// ─────────────────────────────────────────────────────────────────────────────

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final LoanStatus status;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg, String label) = switch (status) {
      LoanStatus.active => (AppColors.green50, AppColors.green700, 'Active'),
      LoanStatus.overdue => (AppColors.red50, AppColors.redInk, 'Overdue'),
      LoanStatus.cleared => (AppColors.blue50, AppColors.blue600, 'Cleared'),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: AppText.chipLabel.copyWith(color: fg),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────

class _LoadingSkeleton extends StatelessWidget {
  const _LoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Dome skeleton
        const Skeleton(width: double.infinity, height: 110, radius: 0),
        Padding(
          padding: const EdgeInsets.all(AppInsets.page),
          child: Column(
            children: const [
              Skeleton(width: double.infinity, height: 120, radius: AppRadii.card),
              SizedBox(height: 11),
              Skeleton(width: double.infinity, height: 50, radius: AppRadii.button),
              SizedBox(height: 11),
              Skeleton(width: double.infinity, height: 200, radius: AppRadii.card),
            ],
          ),
        ),
      ],
    );
  }
}
