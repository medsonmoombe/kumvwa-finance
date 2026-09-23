import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/due_chip.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/client_loan_card.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/loan_request_card.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/pay_sheet.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/profile_stepper_screen.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/terms_gate_screen.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/tenant_terms_sheet.dart';

/// Post-login orchestrator: the profile stepper and platform-terms gates
/// render INSTEAD of the home body until cleared; once in, any lender with
/// unaccepted terms surfaces as an amber card above the loans list.
class ClientHomeScreen extends ConsumerWidget {
  const ClientHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Mock mode has no terms endpoints — render the home directly.
    if (Env.useMocks) return const _HomeScaffold(body: _HomeBody());

    final gate = ref.watch(clientGateProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Loans')),
      body: SafeArea(
        child: gate.when(
          loading: () => const Center(
            child: SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2.5),
            ),
          ),
          error: (e, _) => ListView(
            children: [
              const SizedBox(height: 90),
              const Center(child: Text('Could not load your account')),
              const SizedBox(height: 14),
              Center(
                child: ElevatedButton(
                  onPressed: () => ref.invalidate(clientGateProvider),
                  child: const Text('Retry'),
                ),
              ),
            ],
          ),
          data: (g) {
            if (!g.profileCompleted) return const ProfileStepperScreen();
            if (!g.termsAccepted) return const TermsGateScreen();
            return _HomeBody(gate: g);
          },
        ),
      ),
    );
  }
}

class _HomeScaffold extends StatelessWidget {
  const _HomeScaffold({required this.body});

  final Widget body;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Loans')),
      body: SafeArea(child: body),
    );
  }
}

class _HomeBody extends ConsumerStatefulWidget {
  const _HomeBody({this.gate});

  /// Null in mock mode — no terms endpoints to consult.
  final ClientGateState? gate;

  @override
  ConsumerState<_HomeBody> createState() => _HomeBodyState();
}

class _HomeBodyState extends ConsumerState<_HomeBody> {
  @override
  Widget build(BuildContext context) {
    final async = ref.watch(clientLoansProvider);

    return RefreshIndicator(
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
        data: (loans) => _Body(loans: loans, gate: widget.gate),
      ),
    );
  }
}

class _Body extends ConsumerWidget {
  const _Body({required this.loans, required this.gate});

  final List<Loan> loans;
  final ClientGateState? gate;

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

    // Pending applications mean "no loans YET" — a review is in flight.
    final session = ref.watch(authControllerProvider).session;
    final pendingCount = session == null
        ? 0
        : (ref
                  .watch(loanRequestsByClientProvider(session.userId))
                  .valueOrNull ??
              const <LoanRequest>[])
              .where((r) => r.status == LoanRequestStatus.pending)
              .length;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
      children: [
        // A lender republished their terms — review & accept before borrowing.
        for (final l in gate?.lenders.where((l) => l.needsAcceptance) ??
            const <LenderStatus>[])
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: GestureDetector(
              onTap: () => showTenantTermsSheet(context, ref, l),
              child: Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.amber50,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFF3DCB3)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.description_outlined,
                      size: 19,
                      color: Color(0xFFB26A00),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        '${l.name} updated their lending terms. '
                        'Tap to review & accept.',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: Color(0xFF7A5200),
                          height: 1.45,
                        ),
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      size: 18,
                      color: Color(0xFFB26A00),
                    ),
                  ],
                ),
              ),
            ),
          ),
        if (next != null)
          _NextPaymentCard(loan: next)
        else if (loans.isEmpty && pendingCount > 0)
          // Applications are with the lenders — "no loans" would be wrong.
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.blue50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFB9C6E8)),
            ),
            child: Column(
              children: [
                const Icon(Icons.hourglass_top, size: 34,
                    color: AppColors.blue600),
                const SizedBox(height: 10),
                Text(
                  'Application pending',
                  style: GoogleFonts.poppins(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blue600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  pendingCount == 1
                      ? 'Your application is with the lenders. Once approved '
                          'it will show up here as a loan.'
                      : 'Your $pendingCount applications are with the '
                          'lenders. Once approved they will show up here.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 12.5, color: AppColors.ink2),
                ),
              ],
            ),
          )
        else if (loans.isEmpty)
          // Brand-new client with no loans at all — NOT "all paid up".
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.blue50,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFB9C6E8)),
            ),
            child: Column(
              children: [
                const Icon(Icons.account_balance_wallet_outlined,
                    size: 34, color: AppColors.blue600),
                const SizedBox(height: 10),
                Text(
                  'No loans yet',
                  style: GoogleFonts.poppins(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppColors.blue600,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Your first loan starts here — request one from a lender '
                  'below.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12.5, color: AppColors.ink2),
                ),
              ],
            ),
          )
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
            child: ClientLoanCard(loan: loan),
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
                      onTap: () => context.push('/c/request/${r.id}'),
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
