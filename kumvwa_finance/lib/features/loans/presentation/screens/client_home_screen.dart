import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/due_chip.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/loan_request_card.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/pay_sheet.dart';

class ClientHomeScreen extends ConsumerWidget {
  const ClientHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(clientLoansProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Loans'),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(clientLoansProvider),
          child: async.when(
            loading: () => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              children: const [
                Skeleton(width: double.infinity, height: 150, radius: 20),
                SizedBox(height: 12),
                SkeletonCard(showBadge: true),
                SizedBox(height: 9),
                SkeletonCard(showBadge: true),
                SizedBox(height: 9),
                SkeletonCard(showBadge: true),
              ],
            ),
            error: (_, _) => ListView(
              children: [
                const SizedBox(height: 90),
                const Icon(Icons.cloud_off_outlined,
                    size: 44, color: AppColors.muted),
                const SizedBox(height: 14),
                const Center(child: Text('Could not load your loans')),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 80),
                  child: ElevatedButton(
                    onPressed: () => ref.invalidate(clientLoansProvider),
                    child: const Text('Retry'),
                  ),
                ),
              ],
            ),
            data: (loans) => _Body(loans: loans),
          ),
        ),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.loans});

  final List<Loan> loans;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Soonest upcoming payment across ALL lenders.
    Loan? next;
    for (final l in loans) {
      if (l.nextInstallment == null) continue;
      if (next == null ||
          (l.daysUntilDue ?? 999) < (next.daysUntilDue ?? 999)) {
        next = l;
      }
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
      children: [
        if (next != null)
          _NextPaymentCard(loan: next)
        else
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.green50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFBFE9D2)),
            ),
            child: Column(
              children: [
                const Icon(Icons.celebration_outlined,
                    size: 36, color: AppColors.green700),
                const SizedBox(height: 10),
                Text(
                  'All paid up!',
                  style: GoogleFonts.poppins(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.green700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'You have no upcoming payments.',
                  style: TextStyle(fontSize: 12.5, color: AppColors.ink2),
                ),
              ],
            ),
          ),
        const SizedBox(height: 14),
        OutlinedButton.icon(
          onPressed: () => context.push('/c/request'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.blue600,
            side: const BorderSide(color: AppColors.blue600),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
            minimumSize: const Size.fromHeight(50),
          ),
          icon: const Icon(Icons.add_circle_outline, size: 19),
          label: const Text(
            'Request a new loan',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 14),
        Text(
          'Loans from your lenders (${loans.length})',
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.muted,
          ),
        ),
        const SizedBox(height: 8),
        for (final loan in loans)
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: _ClientLoanCard(loan: loan),
          ),
        if (ref.watch(authControllerProvider).session != null) ...[
          const SizedBox(height: 14),
          _RequestsSection(
            clientId: ref.watch(authControllerProvider).session!.userId,
          ),
        ],
      ],
    );
  }
}

// ---------- my loan requests ----------

class _RequestsSection extends ConsumerWidget {
  const _RequestsSection({required this.clientId});

  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loanRequestsByClientProvider(clientId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'My loan requests',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.muted,
          ),
        ),
        const SizedBox(height: 8),
        async.when(
          loading: () => const SkeletonCard(showBadge: true),
          error: (_, _) => const SizedBox.shrink(),
          data: (requests) {
            if (requests.isEmpty) {
              return const Text(
                'No requests yet — tap "Request a new loan" above.',
                style: TextStyle(fontSize: 11.5, color: AppColors.muted),
              );
            }
            return Column(
              children: [
                for (final r in requests)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: LoanRequestCard(
                      request: r,
                      titleName: r.lenderName,
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

// ---------- next payment hero ----------

class _NextPaymentCard extends ConsumerWidget {
  const _NextPaymentCard({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final next = loan.nextInstallment!;
    final days = loan.daysUntilDue ?? 0;

    return ClipRRect(
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
                const Text(
                  'Next payment',
                  style: TextStyle(fontSize: 11, color: Color(0xFFAFC3EE)),
                ),
                DueChip(dueDate: next.dueDate),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              Fmt.money(next.amount, decimals: 2),
              style: GoogleFonts.poppins(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            Text(
              '${loan.lenderName} · due ${Fmt.date(next.dueDate)}',
              style: const TextStyle(
                  fontSize: 11.5, color: Color(0xFFC6D4F2)),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => showPaySheet(context, ref, loan),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.green500,
                      minimumSize: const Size.fromHeight(46),
                    ),
                    child: Text(
                      days < 0 ? 'Pay Overdue Now' : 'Pay Now',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                const SizedBox(width: 9),
                OutlinedButton(
                  onPressed: () => context.push('/c/loan/${loan.id}'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: Color(0xFF5B7BC7)),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                    ),
                    fixedSize: const Size(110, 46),
                    padding: EdgeInsets.zero,
                  ),
                  child:
                      const Text('Details', style: TextStyle(fontSize: 13)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- one loan card ----------

class _ClientLoanCard extends StatelessWidget {
  const _ClientLoanCard({required this.loan});

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
