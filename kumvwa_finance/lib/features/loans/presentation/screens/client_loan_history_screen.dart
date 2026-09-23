import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/client_loan_card.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/loan_request_card.dart';

/// Borrower's loan history: every loan (active, overdue, cleared) plus every
/// loan application they have sent. Tapping any row opens the full detail.
class ClientLoanHistoryScreen extends ConsumerWidget {
  const ClientLoanHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;
    final clientId = session?.userId ?? '';
    final loansAsync = ref.watch(clientLoansProvider);
    final requestsAsync = ref.watch(loanRequestsByClientProvider(clientId));

    return Scaffold(
      appBar: AppBar(title: const Text('Loan History')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(clientLoansProvider);
            ref.invalidate(loanRequestsByClientProvider(clientId));
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
            children: [
              const _SectionTitle('Loans'),
              const SizedBox(height: 8),
              loansAsync.when(
                loading: () => const SkeletonList(
                  count: 2,
                  height: 72,
                  radius: 16,
                ),
                error: (_, _) => _ErrorHint(
                  label: 'Could not load your loans',
                  onRetry: () => ref.invalidate(clientLoansProvider),
                ),
                data: (loans) {
                  final pending =
                      (requestsAsync.valueOrNull ?? const <LoanRequest>[])
                          .where(
                            (r) => r.status == LoanRequestStatus.pending,
                          )
                          .length;
                  if (loans.isNotEmpty) {
                    return Column(
                      children: [
                        for (final loan in loans)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 9),
                            child: ClientLoanCard(loan: loan),
                          ),
                      ],
                    );
                  }
                  // A pending application isn't a loan yet, but it is also
                  // not "completely no loans" — acknowledge the review.
                  if (pending > 0) {
                    return _EmptyHint(
                      icon: Icons.hourglass_top,
                      text: pending == 1
                          ? 'No loans yet — you have 1 application with the '
                              'lenders. It will appear here once approved.'
                          : 'No loans yet — you have $pending applications '
                              'with the lenders. They will appear here once '
                              'approved.',
                    );
                  }
                  return const _EmptyHint(
                    icon: Icons.account_balance_wallet_outlined,
                    text: 'No loans yet. Request one from the Home tab.',
                  );
                },
              ),
const SizedBox(height: 18),
                             const _SectionTitle('Loan requests'),
              const SizedBox(height: 8),
              requestsAsync.when(
                loading: () => const SkeletonList(
                  count: 2,
                  height: 72,
                  radius: 16,
                ),
                error: (_, _) => _ErrorHint(
                  label: 'Could not load your requests',
                  onRetry: () =>
                      ref.invalidate(loanRequestsByClientProvider(clientId)),
                ),
                data: (requests) => requests.isEmpty
                    ? const _EmptyHint(
                        icon: Icons.send_outlined,
                        text:
                            'No applications yet — request a loan from the '
                            'Home tab.',
                      )
                    : Column(
                        children: [
                          for (final r in requests)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 9),
                              child: LoanRequestCard(
                                request: r,
                                titleName: r.lenderName,
                                onTap: () =>
                                    context.push('/c/request/${r.id}'),
                              ),
                            ),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: AppColors.muted,
      ),
    );
  }
}

class _EmptyHint extends StatelessWidget {
  const _EmptyHint({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 14),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          Icon(icon, size: 24, color: AppColors.muted),
          const SizedBox(height: 8),
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11.5, color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _ErrorHint extends StatelessWidget {
  const _ErrorHint({required this.label, required this.onRetry});

  final String label;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.red50,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: AppColors.red),
          ),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

/// Small grouped skeleton for the history screen's section lists.
class SkeletonList extends StatelessWidget {
  const SkeletonList({
    super.key,
    this.count = 2,
    this.height = 72,
    this.radius = 16,
  });

  final int count;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < count; i++)
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: Skeleton(width: double.infinity, height: height,
                radius: radius),
          ),
      ],
    );
  }
}