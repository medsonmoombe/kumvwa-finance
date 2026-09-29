import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/client_dome_header.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/history_tile.dart';

/// Borrowing record as a compact, grouped list. Home carries hero surfaces;
/// History keeps loan and application events dense and easy to scan.
class ClientLoanHistoryScreen extends ConsumerStatefulWidget {
  const ClientLoanHistoryScreen({super.key});

  @override
  ConsumerState<ClientLoanHistoryScreen> createState() =>
      _ClientLoanHistoryScreenState();
}

class _ClientLoanHistoryScreenState
    extends ConsumerState<ClientLoanHistoryScreen> {
  int _tab = 0; // 0 = Loans, 1 = Applications

  @override
  Widget build(BuildContext context) {
    final clientId = ref.watch(authControllerProvider).session?.userId ?? '';
    final loansAsync = ref.watch(clientLoansProvider);
    final requestsAsync = ref.watch(loanRequestsByClientProvider(clientId));

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.blue600,
          onRefresh: () async {
            ref.invalidate(clientLoansProvider);
            ref.invalidate(loanRequestsByClientProvider(clientId));
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            children: [
              // Dome scrolls with content
              ClientDomeHeader(
                title: 'History',
                subtitle: '${loansAsync.valueOrNull?.length ?? 0} loans · '
                    '${requestsAsync.valueOrNull?.length ?? 0} applications',
                bottom: Container(
                  height: 44,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(AppRadii.input),
                  ),
                  child: Row(
                    children: [
                      _SegBtn(
                        label: 'Loans',
                        active: _tab == 0,
                        onTap: () => setState(() => _tab = 0),
                        onDome: true,
                      ),
                      _SegBtn(
                        label: 'Applications',
                        active: _tab == 1,
                        onTap: () => setState(() => _tab = 1),
                        onDome: true,
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 90),
                child: _tab == 0
                    ? loansAsync.when(
                        loading: () => const Skeleton(width: double.infinity, height: 58, radius: 13),
                        error: (e, _) => _ErrorHint(
                          label: 'Could not load your loans',
                          detail: describeApiError(e),
                          onRetry: () => ref.invalidate(clientLoansProvider),
                        ),
                        data: (loans) => _LoansSection(loans: loans),
                      )
                    : requestsAsync.when(
                        loading: () => const Skeleton(width: double.infinity, height: 134, radius: 15),
                        error: (e, _) => _ErrorHint(
                          label: 'Could not load your applications',
                          detail: describeApiError(e),
                          onRetry: () => ref.invalidate(loanRequestsByClientProvider(clientId)),
                        ),
                        data: (requests) => _ApplicationsSection(requests: requests),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Segmented control button — matches HTML .seg button
class _SegBtn extends StatelessWidget {
  const _SegBtn({
    required this.label,
    required this.active,
    required this.onTap,
    this.onDome = false,
  });
  final String label;
  final bool active;
  final VoidCallback onTap;
  final bool onDome;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active
                ? (onDome
                    ? Colors.white.withValues(alpha: 0.25)
                    : Colors.white)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(AppRadii.xs),
            boxShadow: active && !onDome ? AppShadows.shSeg : null,
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: active ? FontWeight.w700 : FontWeight.w600,
              color: onDome
                  ? Colors.white
                  : (active ? AppColors.ink : AppColors.muted),
            ),
          ),
        ),
      ),
    );
  }
}

class _LoansSection extends StatelessWidget {
  const _LoansSection({required this.loans});

  final List<Loan> loans;

  @override
  Widget build(BuildContext context) {
    final borrowed = loans.fold<double>(0, (sum, loan) => sum + loan.principal);
    final repaid = loans.fold<double>(0, (sum, loan) => sum + loan.amountPaid);
    final cleared = loans
        .where((loan) => loan.status == LoanStatus.cleared)
        .length;

    return Column(
      children: [
        _Summary(borrowed: borrowed, repaid: repaid, cleared: cleared),
        const SizedBox(height: 13),
        _SectionTitle('Loans', count: loans.length),
        const SizedBox(height: 6),
        if (loans.isEmpty)
          const _EmptyHint(
            icon: Icons.account_balance_wallet_outlined,
            text: 'No loans yet. Request one from the Home tab.',
          )
        else
          _Group(
            children: [
              for (final loan in loans)
                HistoryTile(
                  title: loan.lenderName,
                  subtitle: _loanSubtitle(loan),
                  amount: Fmt.money(
                    loan.status == LoanStatus.cleared
                        ? loan.amountPaid
                        : loan.outstanding,
                  ),
                  statusLabel: _loanLabel(loan.status),
                  statusColor: _loanStatusColor(loan.status),
                  statusDotColor: _loanDotColor(loan.status),
                  avatarGradient: _loanGradient(loan.status),
                  avatarInitials: Fmt.initials(loan.lenderName),
                  onTap: () => context.push('/c/loan/${loan.id}'),
                ),
            ],
          ),
      ],
    );
  }
}

class _ApplicationsSection extends StatelessWidget {
  const _ApplicationsSection({required this.requests});

  final List<LoanRequest> requests;

  @override
  Widget build(BuildContext context) {
    final open = requests
        .where((request) => request.status != LoanRequestStatus.approved)
        .toList();

    return Column(
      children: [
        _SectionTitle('Applications', count: open.length),
        const SizedBox(height: 6),
        if (open.isEmpty)
          const _EmptyHint(
            icon: Icons.send_outlined,
            text: 'No applications to show.',
          )
        else
          _Group(
            children: [
              for (final request in open)
                HistoryTile(
                  title: request.lenderName,
                  subtitle: _requestSubtitle(request),
                  amount: Fmt.money(request.amount),
                  statusLabel: request.status == LoanRequestStatus.pending
                      ? 'Pending'
                      : 'Declined',
                  statusColor: request.status == LoanRequestStatus.pending
                      ? const Color(0xFFB26A00)
                      : const Color(0xFFC03538),
                  statusDotColor: request.status == LoanRequestStatus.pending
                      ? AppColors.amber
                      : AppColors.red,
                  avatarGradient: request.status == LoanRequestStatus.pending
                      ? const [AppColors.blue500, AppColors.blue900]
                      : const [Color(0xFFB26A00), Color(0xFF8A5000)],
                  avatarInitials: Fmt.initials(request.lenderName),
                  onTap: () => context.push('/c/request-status/${request.id}'),
                ),
            ],
          ),
      ],
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({
    required this.borrowed,
    required this.repaid,
    required this.cleared,
  });

  final double borrowed;
  final double repaid;
  final int cleared;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.blue50,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: const Color(0xFFDCE7FB)),
      ),
      child: Row(
        children: [
          _SummaryCell(label: 'Borrowed', value: Fmt.money(borrowed)),
          const _SummaryDivider(),
          _SummaryCell(label: 'Repaid', value: Fmt.money(repaid)),
          const _SummaryDivider(),
          _SummaryCell(label: 'Cleared', value: '$cleared'),
        ],
      ),
    );
  }
}

class _SummaryCell extends StatelessWidget {
  const _SummaryCell({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Column(
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 8,
            fontWeight: FontWeight.w700,
            letterSpacing: 0.7,
            color: AppColors.blue600,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            color: AppColors.blue900,
          ),
        ),
      ],
    ),
  );
}

class _SummaryDivider extends StatelessWidget {
  const _SummaryDivider();
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, height: 28, color: const Color(0xFFD8E2F6));
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label, {required this.count});
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Text(
        label,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w700,
          color: AppColors.muted,
        ),
      ),
      const SizedBox(width: 6),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: const Color(0xFFE9EDF4),
          borderRadius: BorderRadius.circular(99),
        ),
        child: Text(
          '$count',
          style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: AppColors.ink2,
          ),
        ),
      ),
    ],
  );
}

class _Group extends StatelessWidget {
  const _Group({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      children: [
        for (var index = 0; index < children.length; index++) ...[
          if (index > 0)
            const Padding(
              padding: EdgeInsets.only(left: 59),
              child: Divider(height: 1, color: Color(0xFFF2F4F8)),
            ),
          children[index],
        ],
      ],
    ),
  );
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.icon, required this.text});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      children: [
        Icon(icon, size: 24, color: AppColors.muted),
        const SizedBox(height: 8),
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 11, color: AppColors.muted),
        ),
      ],
    ),
  );
}

class _ErrorHint extends StatelessWidget {
  const _ErrorHint({required this.label, required this.onRetry, this.detail});
  final String label;
  final VoidCallback onRetry;

  /// Why it failed — status code + server message, or the parse error. Shown
  /// muted so a screenshot says which endpoint rejected the call.
  final String? detail;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.red50,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.red)),
        if (detail != null) ...[
          const SizedBox(height: 4),
          Text(
            detail!,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
        const SizedBox(height: 8),
        TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    ),
  );
}

String _loanSubtitle(Loan loan) {
  if (loan.status == LoanStatus.cleared) {
    final date = loan.schedule.isEmpty ? null : loan.schedule.last.dueDate;
    return date == null
        ? 'Repaid in full'
        : 'Repaid in full · ${Fmt.date(date)}';
  }
  final due = loan.nextInstallment?.dueDate;
  return due == null
      ? 'Balance ${Fmt.money(loan.outstanding)}'
      : 'Balance ${Fmt.money(loan.outstanding)} · due ${Fmt.date(due)}';
}

String _requestSubtitle(LoanRequest request) {
  final purpose = request.purpose.trim();
  final prefix = purpose.length >= 8 ? '"$purpose" · ' : '';
  return '${prefix}Requested ${Fmt.date(request.requestedAt)} · '
      '${request.termInstallments} mo';
}

String _loanLabel(LoanStatus status) => switch (status) {
  LoanStatus.active => 'Active',
  LoanStatus.overdue => 'Overdue',
  LoanStatus.cleared => 'Cleared',
};

Color _loanStatusColor(LoanStatus status) => switch (status) {
  LoanStatus.active => AppColors.blue600,
  LoanStatus.overdue => const Color(0xFFC03538),
  LoanStatus.cleared => AppColors.green700,
};

Color _loanDotColor(LoanStatus status) => switch (status) {
  LoanStatus.active => AppColors.blue500,
  LoanStatus.overdue => AppColors.red,
  LoanStatus.cleared => AppColors.green500,
};

List<Color> _loanGradient(LoanStatus status) => switch (status) {
  LoanStatus.active => const [AppColors.blue500, AppColors.blue900],
  LoanStatus.overdue => const [AppColors.red, Color(0xFF9F2629)],
  LoanStatus.cleared => const [AppColors.green500, AppColors.green700],
};
