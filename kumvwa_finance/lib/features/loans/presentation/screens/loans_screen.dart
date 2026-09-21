import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/app_filter_chip.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';

class LoansScreen extends ConsumerWidget {
  const LoansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loansProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Loans'),
            const SizedBox(width: 8),
            AppBadge('${async.valueOrNull?.length ?? 0} total'),
          ],
        ),
        actions: [
          if (ref.watch(authControllerProvider).session != null)
            _RequestsButton(
              lenderId: ref.watch(authControllerProvider).session!.userId,
            ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(loansProvider),
          child: async.when(
            loading: () => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
              children: const [
                Row(
                  children: [
                    Skeleton(width: 48, height: 30, radius: 99),
                    SizedBox(width: 8),
                    Skeleton(width: 62, height: 30, radius: 99),
                    SizedBox(width: 8),
                    Skeleton(width: 74, height: 30, radius: 99),
                  ],
                ),
                SizedBox(height: 14),
                SkeletonCard(showBadge: true),
                SizedBox(height: 9),
                SkeletonCard(showBadge: true),
                SizedBox(height: 9),
                SkeletonCard(showBadge: true),
                SizedBox(height: 9),
                SkeletonCard(showBadge: true),
              ],
            ),
            error: (_, _) =>
                _ErrorView(onRetry: () => ref.invalidate(loansProvider)),
            data: (loans) => _List(loans: loans),
          ),
        ),
      ),
    );
  }
}

class _List extends StatefulWidget {
  const _List({required this.loans});

  final List<Loan> loans;

  @override
  State<_List> createState() => _ListState();
}

class _ListState extends State<_List> {
  LoanStatus? _filter; // null = all

  @override
  Widget build(BuildContext context) {
    final filtered = widget.loans
        .where((l) => _filter == null || l.status == _filter)
        .toList();

    return Column(
      children: [
        SizedBox(
          height: 34,
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                AppFilterChip(
                  label: 'All',
                  selected: _filter == null,
                  onTap: () => setState(() => _filter = null),
                ),
                const SizedBox(width: 8),
                for (final s in LoanStatus.values) ...[
                  AppFilterChip(
                    label: switch (s) {
                      LoanStatus.active => 'Active',
                      LoanStatus.overdue => 'Overdue',
                      LoanStatus.cleared => 'Cleared',
                    },
                    selected: _filter == s,
                    onTap: () => setState(() => _filter = s),
                  ),
                  if (s != LoanStatus.cleared) const SizedBox(width: 8),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Expanded(
          child: filtered.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    SizedBox(height: 90),
                    Icon(
                      Icons.search_off_outlined,
                      size: 44,
                      color: AppColors.muted,
                    ),
                    SizedBox(height: 14),
                    Center(child: Text('No loans in this filter')),
                  ],
                )
              : ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 2, 16, 90),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: LoanCard(
                      loan: filtered[i],
                      onTap: () => context.push('/loans/${filtered[i].id}'),
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}

class LoanCard extends StatelessWidget {
  const LoanCard({super.key, required this.loan, required this.onTap});

  final Loan loan;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
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
                    Fmt.initials(loan.clientName),
                    style: AppText.caption.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const SizedBox(width: 11),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        loan.clientName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.body.copyWith(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${loan.id} · ${loan.termInstallments} mo · '
                        '${loan.interestRatePct.toStringAsFixed(0)}%',
                        style: AppText.subText,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    AmountText(loan.totalDue),
                    const SizedBox(height: 4),
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
              ],
            ),
            const SizedBox(height: 10),
            // repayment progress
            ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: SizedBox(
                height: 5,
                child: Stack(
                  children: [
                    Container(color: const Color(0xFFE9EDF5)),
                    FractionallySizedBox(
                      widthFactor: loan.progress,
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [AppColors.green500, AppColors.blue500],
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
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.cloud_off_outlined, size: 44, color: AppColors.muted),
        const SizedBox(height: 14),
        const Center(child: Text('Could not load loans')),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 80),
          child: ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
        ),
      ],
    );
  }
}

// ---------- requests inbox entry ----------

class _RequestsButton extends ConsumerWidget {
  const _RequestsButton({required this.lenderId});

  final String lenderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pending = ref
            .watch(loanRequestsByLenderProvider(lenderId))
            .valueOrNull
            ?.where((r) => r.status == LoanRequestStatus.pending)
            .length ??
        0;

    return Stack(
      children: [
        IconButton(
          onPressed: () => context.push('/requests'),
          style: IconButton.styleFrom(
            backgroundColor: AppColors.card,
            side: const BorderSide(color: AppColors.line),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(11),
            ),
          ),
          icon: const Icon(Icons.pending_actions_outlined,
              size: 20, color: AppColors.ink2),
        ),
        if (pending > 0)
          Positioned(
            top: 7,
            right: 7,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: AppColors.red,
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: Colors.white, width: 1.5),
              ),
              constraints: const BoxConstraints(minWidth: 15),
              child: Text(
                '$pending',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 8.5,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
