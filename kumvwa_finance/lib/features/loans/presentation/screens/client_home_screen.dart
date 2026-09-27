import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/pay_sheet.dart';
import 'package:kumvwa_finance/features/notifications/data/notifications_repository.dart';
import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';
import 'package:kumvwa_finance/features/onboarding/domain/registration_gate.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/profile_stepper_screen.dart';
import 'package:kumvwa_finance/features/onboarding/presentation/screens/tenant_terms_sheet.dart';

/// Post-login orchestrator: the profile stepper renders INSTEAD of the home
/// body until cleared; once in, any lender with unaccepted terms surfaces as
/// an amber card above the rest.
///
/// Home v2 mirrors the client design mockup: no brand bar — the greeting
/// header leads, the hero is either a payment bill or the borrowing ladder,
/// pending applications and term updates queue as cards, and the bell shows a
/// real red unread count. Product copy stays strictly typographic; the wave
/// greeting is the only soft glyph, rendered as a waving-hand icon.
class ClientHomeScreen extends ConsumerWidget {
  const ClientHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (Env.useMocks) return const _HomeScaffold(body: _HomeBody());

    final gate = ref.watch(clientGateProvider);

    return _HomeScaffold(
      body: gate.when(
        loading: () => const Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ),
        error: (e, _) => _ErrorRetry(
          message: 'Could not load your account',
          onRetry: () => ref.invalidate(clientGateProvider),
        ),
        data: (g) {
          // A missing required registration field binds the borrower to the
          // stepper — unless a loan still awaits repayment, in which case they
          // are let in to settle it first (queued as a card) and bound the
          // moment the balance clears.
          if (g.registration.bindsToStepper) {
            return const ProfileStepperScreen();
          }
          if (!g.termsAccepted) return _PlatformTermsGate(gate: g);
          return _HomeBody(gate: g);
        },
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
      backgroundColor: AppColors.bg,
      body: SafeArea(child: body),
    );
  }
}

/// The mockup header: green gradient avatar (initials), a muted time-of-day
/// greeting over the full name, and the bell as a raised button with a red
/// numbered unread badge. Tapping the avatar opens the profile.
class _HomeHeader extends ConsumerWidget {
  const _HomeHeader({required this.session});

  final UserSession session;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref
        .watch(notificationsProvider(session.role))
        .valueOrNull
        ?.where((n) => !n.read)
        .length;
    final count = unread ?? 0;

    return Row(
      children: [
        GestureDetector(
          onTap: () => context.push('/c/profile'),
          child: Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [AppColors.green500, AppColors.green700],
              ),
            ),
            child: Text(
              Fmt.initials(session.displayName),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _greeting(),
                    style: const TextStyle(fontSize: 11, color: AppColors.muted),
                  ),
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.waving_hand_rounded,
                    size: 12,
                    color: AppColors.muted,
                  ),
                ],
              ),
              Text(
                session.displayName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => context.go('/c/alerts'),
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.line),
            ),
            child: Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                const Icon(
                  Icons.notifications_none_rounded,
                  size: 20,
                  color: AppColors.ink2,
                ),
                if (count > 0)
                  Positioned(
                    top: -6,
                    right: -6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      constraints: const BoxConstraints(minWidth: 14),
                      height: 14,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.red,
                        shape: BoxShape.circle,
                      ),
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: const TextStyle(
                          fontSize: 7.5,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

String _greeting() {
  final hour = DateTime.now().hour;
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ---------- platform terms gate ----------

/// Shown when the client hasn't accepted the current platform terms yet.
/// Blocks access to the home body until they accept.
class _PlatformTermsGate extends ConsumerStatefulWidget {
  const _PlatformTermsGate({required this.gate});

  final ClientGateState gate;

  @override
  ConsumerState<_PlatformTermsGate> createState() => _PlatformTermsGateState();
}

class _PlatformTermsGateState extends ConsumerState<_PlatformTermsGate> {
  bool _busy = false;
  String? _error;

  Future<void> _accept() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(apiClientProvider)
          .postA('/terms/accept', data: {'scope': 'platform_client'});
      ref.invalidate(clientGateProvider);
    } catch (e) {
      setState(() {
        _busy = false;
        _error = 'Could not record acceptance. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.description_outlined,
                size: 48,
                color: AppColors.blue600,
              ),
              const SizedBox(height: 16),
              Text(
                'Platform Terms of Service',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please read and accept the Kumvwa Finance Terms of Service to continue.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.muted, height: 1.5),
              ),
              const SizedBox(height: 20),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.line),
                  ),
                  child: SingleChildScrollView(
                    child: Text(
                      widget.gate.termsBody.isEmpty
                          ? 'Loading terms…'
                          : widget.gate.termsBody,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.ink2,
                        height: 1.6,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (_error != null) ...[
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: AppColors.red),
                ),
                const SizedBox(height: 8),
              ],
              ElevatedButton(
                onPressed: _busy ? null : _accept,
                child: _busy
                    ? const ButtonSpinner()
                    : const Text('I Accept the Terms'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------- home body ----------

class _HomeBody extends ConsumerWidget {
  const _HomeBody({this.gate});

  /// Null in mock mode — no terms endpoints to consult.
  final ClientGateState? gate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loansAsync = ref.watch(clientLoansProvider);
    final session = ref.watch(authControllerProvider).session;
    final clientId = session?.userId ?? '';

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(clientLoansProvider);
        ref.invalidate(loanRequestsByClientProvider(clientId));
        ref.invalidate(_homeLimitProvider);
        ref.invalidate(notificationsProvider(session?.role ?? 'client'));
        // Settling a loan is what releases the borrower from the registration
        // gate, so the gate has to be re-judged on the same refresh.
        ref.invalidate(clientGateProvider);
      },
      child: loansAsync.when(
        loading: () => const _RefreshGrid(child: _LoadingView()),
        error: (e, _) => _RefreshGrid(
          child: _ErrorRetry(
            message: 'Could not load your loans',
            onRetry: () => ref.invalidate(clientLoansProvider),
          ),
        ),
        data: (loans) => _Body(loans: loans, gate: gate),
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
    final session = ref.watch(authControllerProvider).session;
    if (session == null) return const SizedBox.shrink();
    final clientId = session.userId;

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 90),
      children: [
        _HomeHeader(session: session),
        const SizedBox(height: 11),
        // State-driven hero: payment due → borrow capacity → quiet presence.
        const _HeroSection(),
        const SizedBox(height: 12),
        // Registration is outstanding but the balance must clear first — the
        // stepper is queued below the hero and only unlocks once the loan is
        // settled, so paying is always the first thing they are offered.
        if (gate?.registration.owesThenRegisters ?? false)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _RegistrationPendingCard(decision: gate!.registration),
          ),
        const SizedBox(height: 12),
        // Applications in flight (pending amber badge), then any lender that
        // republished their terms — the queued-attention stack. Declined
        // applications stay in History; home keeps only open loops.
        _ApplicationsStrip(clientId: clientId),
        for (final l
            in gate?.lenders.where((l) => !l.termsAccepted) ??
                const <LenderStatus>[])
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: _HomeCard(
              title: '${l.name} updated their terms',
              subtitle: 'Tap to review & accept',
              leading: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFFDF3E0),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.description_outlined,
                  size: 16,
                  color: Color(0xFFB26A00),
                ),
              ),
              trailing: const Icon(
                Icons.chevron_right_rounded,
                size: 18,
                color: Color(0xFFB26A00),
              ),
              backgroundColor: const Color(0xFFFDF3E0),
              onTap: () => showTenantTermsSheet(context, ref, l),
            ),
          ),
        const SizedBox(height: 14),
        _ActivityStrip(role: session.role),
      ],
    );
  }
}

// ---------- state hero ----------

/// One primary surface, strict priority:
///   1. the soonest upcoming payment (act first),
///   2. the borrow limit (the only surface that offers a new application).
/// A pending application never hides either — it queues as a card below
/// (mockup: "everything else is queued attention").
class _HeroSection extends ConsumerWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loans = ref.watch(clientLoansProvider).valueOrNull ?? const <Loan>[];
    final withDue = loans
        .where((l) => l.nextInstallment != null)
        .map((l) => (loan: l, due: l.nextInstallment!.dueDate))
        .toList();
    if (withDue.isNotEmpty) {
      withDue.sort((a, b) => a.due.compareTo(b.due));
      return _PaymentHero(loan: withDue.first.loan);
    }

    return ref.watch(_homeLimitProvider).when(
      loading: () =>
          const Skeleton(width: double.infinity, height: 150, radius: 20),
      error: (_, _) => const _WelcomeCard(),
      data: (limit) => limit == null ? const _WelcomeCard() : _LimitHero(limit: limit),
    );
  }
}

// ---------- payment hero ----------

class _PaymentHero extends ConsumerWidget {
  const _PaymentHero({required this.loan});

  final Loan loan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final next = loan.nextInstallment!;
    final days = loan.daysUntilDue ?? 0;
    final theme = lenderTheme(ref, loan.tenantId);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: theme.gradient,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -30,
              top: -30,
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.07),
                ),
              ),
            ),
            Positioned(
              right: 40,
              bottom: -40,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'NEXT PAYMENT',
                      style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.6,
                        color: Color(0xFFAFC3EE),
                      ),
                    ),
                    _DuePill(days: days, dueDate: next.dueDate),
                  ],
                ),
                const SizedBox(height: 6),
                _BigKwacha(amount: next.amount + next.penalty),
                if (next.penalty > 0)
                  Text(
                    'includes penalty ${Fmt.money(next.penalty, decimals: 2)}',
                    style: const TextStyle(fontSize: 10, color: Color(0xFF9FB4E4)),
                  ),
                const SizedBox(height: 3),
                Text(
                  '${loan.lenderName} · due ${Fmt.date(next.dueDate)}',
                  style: const TextStyle(fontSize: 11, color: Color(0xFFBFD0F2)),
                ),
                const SizedBox(height: 13),
                Row(
                  children: [
                    Expanded(
                      flex: 14,
                      child: ElevatedButton(
                        onPressed: () => showPaySheet(context, ref, loan),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.green500,
                          minimumSize: const Size.fromHeight(46),
                        ),
                        child: Text(
                          days < 0 ? 'Pay Overdue Now' : 'Pay Now',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 8,
                      child: OutlinedButton(
                        onPressed: () => context.push('/c/loan/${loan.id}'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Color(0xFF5B7BC7), width: 1.5),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          minimumSize: const Size.fromHeight(46),
                        ),
                        child: const Text(
                          'Details',
                          style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The mockup's due pill: white translucent capsule, schedule icon + text.
class _DuePill extends StatelessWidget {
  const _DuePill({required this.days, required this.dueDate});

  final int days;
  final DateTime dueDate;

  @override
  Widget build(BuildContext context) {
    final String label;
    if (days < 0) {
      label = '${-days} days overdue';
    } else if (days == 0) {
      label = 'due today · ${DateFormat('d MMM').format(dueDate)}';
    } else if (days == 1) {
      label = 'due tomorrow · ${DateFormat('d MMM').format(dueDate)}';
    } else {
      label =
          'due in $days days · ${DateFormat('d MMM').format(dueDate)}';
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.schedule_rounded, size: 10, color: Color(0xFFBFD0F2)),
          const SizedBox(width: 3),
          Text(
            label,
            style: const TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: Color(0xFFBFD0F2),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------- borrow-capacity hero ----------

class _LimitHero extends ConsumerWidget {
  const _LimitHero({required this.limit});

  final _HomeLimit limit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final nt = limit.nextTier;
    final reached = nt == null
        ? 5
        : (nt.clearedNeeded - nt.clearedRemaining).clamp(0, 5);
    final theme = lenderTheme(ref, limit.tenantId);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: theme.gradient,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -30,
              top: -30,
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.07),
                ),
              ),
            ),
            Positioned(
              right: 40,
              bottom: -40,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'YOU CAN BORROW UP TO',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                    color: Color(0xFFAFC3EE),
                  ),
                ),
                const SizedBox(height: 6),
                _BigKwacha(amount: limit.limitKwacha),
                const SizedBox(height: 5),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.green500.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.star_rounded, size: 10, color: Color(0xFF7FE8AC)),
                      const SizedBox(width: 4),
                      Text(
                        '${limit.tier} · with ${limit.lenderName}',
                        style: const TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF7FE8AC),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 13),
                _Ladder(reached: reached, nextTier: nt),
                const SizedBox(height: 13),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => context.push('/c/request'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.green500,
                      minimumSize: const Size.fromHeight(46),
                      elevation: 0,
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add_rounded, size: 18),
                        SizedBox(width: 6),
                        Text(
                          'Apply for a Loan',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// The mockup ladder: capped scale, a thin gradient progress bar, and the
/// "Repay N more loans to unlock K X" caption with bold highlights.
class _Ladder extends StatelessWidget {
  const _Ladder({required this.reached, required this.nextTier});

  final int reached;
  final CreditNextTier? nextTier;

  @override
  Widget build(BuildContext context) {
    final fill = reached / 5 * 100;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'K 1,000',
              style: TextStyle(fontSize: 9, color: Color(0xFFA9BEE8)),
            ),
            Text(
              'K 20,000',
              style: TextStyle(fontSize: 9, color: Color(0xFFA9BEE8)),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: Container(
            height: 6,
            decoration: const BoxDecoration(color: Color(0x2EFFFFFF)),
            child: FractionallySizedBox(
              alignment: Alignment.centerLeft,
              widthFactor: fill / 100,
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.green500, Color(0xFF7FE8AC)],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        if (nextTier != null)
          Text.rich(
            TextSpan(
              style: const TextStyle(fontSize: 9.5, color: Color(0xFFBFD0F2)),
              children: [
                const TextSpan(text: 'Repay '),
                TextSpan(
                  text: '${nextTier!.clearedRemaining} more '
                      'loan${nextTier!.clearedRemaining == 1 ? '' : 's'}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF7FE8AC),
                  ),
                ),
                const TextSpan(text: ' to unlock '),
                TextSpan(
                  text: Fmt.money(nextTier!.limitKwacha),
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF7FE8AC),
                  ),
                ),
              ],
            ),
          )
        else
          const Text(
            'Top rung reached. Keep repaying on time.',
            style: TextStyle(fontSize: 9.5, color: Color(0xFFBFD0F2)),
          ),
      ],
    );
  }
}

// ---------- quiet hero ----------

/// When no lender limit is available yet, Home retains the visual anchor of a
/// lender-owned banner instead of dropping to a generic white empty state.
class _WelcomeCard extends ConsumerWidget {
  const _WelcomeCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lenders = ref.watch(lenderBrandingProvider);
    final tenantId = lenders.keys.firstOrNull;
    final theme = lenderTheme(ref, tenantId);

    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 166,
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: theme.gradient,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -30,
              top: -30,
              child: Container(
                width: 160,
                height: 160,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.07),
                ),
              ),
            ),
            Positioned(
              right: 40,
              bottom: -48,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                ),
              ),
            ),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'WELCOME BACK',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                    color: Color(0xFFAFC3EE),
                  ),
                ),
                SizedBox(height: 7),
                Text(
                  'Your next opportunity\nis on its way.',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 7),
                Text(
                  'We will let you know when borrowing opens for you.',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFFBFD0F2),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- reusable card ----------

/// The borrower owes money AND has required registration fields missing.
/// They get the app (so the debt can be cleared) but the stepper stays locked
/// until the balance is settled — the card names what is still outstanding and
/// points back at the payment, not at the form.
class _RegistrationPendingCard extends StatelessWidget {
  const _RegistrationPendingCard({required this.decision});

  final RegistrationDecision decision;

  @override
  Widget build(BuildContext context) {
    final missing = decision.missing.map((f) => f.label).toList();
    final amount = decision.openTotalOutstanding;
    final owed = amount > 0
        ? 'Clear your balance of K${amount.toStringAsFixed(2)} first'
        : 'Clear your balance first';

    return _HomeCard(
      title: 'Finish your registration',
      subtitle: missing.isEmpty
          ? '$owed, then complete your profile.'
          : '$owed, then: ${missing.join(', ')}.',
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: const Color(0xFFFDF3E0),
          borderRadius: BorderRadius.circular(11),
        ),
        child: const Icon(
          Icons.assignment_late_rounded,
          size: 17,
          color: Color(0xFFB26A00),
        ),
      ),
      trailing: const Icon(
        Icons.lock_clock_outlined,
        size: 17,
        color: Color(0xFFB26A00),
      ),
      backgroundColor: const Color(0xFFFDF3E0),
    );
  }
}

/// Reusable tappable card — the shared tile for terms, applications and
/// notifications. Icons and accents differ, the layout never does.
class _HomeCard extends StatelessWidget {
  const _HomeCard({
    required this.title,
    this.subtitle,
    this.leading,
    this.trailing,
    this.onTap,
    this.backgroundColor = Colors.white,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              if (leading != null) ...[
                leading!,
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                        height: 1.4,
                      ),
                    ),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        subtitle!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.muted,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
            ],
          ),
        ),
      ),
    );
  }
}

// ---------- kwacha display ----------

/// Big hero number with the mockup's small "K" prefix (K2,500 style).
class _BigKwacha extends StatelessWidget {
  const _BigKwacha({required this.amount});

  final double amount;

  @override
  Widget build(BuildContext context) {
    final n = NumberFormat.decimalPattern()
      ..maximumFractionDigits = 2
      ..minimumFractionDigits = 0;
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: 'K',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF9FB4E4).withValues(alpha: 0.9),
            ),
          ),
          TextSpan(
            text: n.format(amount),
            style: GoogleFonts.poppins(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------- my applications ----------

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.onSeeAll});

  final String title;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: AppColors.muted,
          ),
        ),
        const Spacer(),
        if (onSeeAll != null)
          GestureDetector(
            onTap: onSeeAll,
            child: const Text(
              'See all',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.blue600,
              ),
            ),
          ),
      ],
    );
  }
}

/// Applications in flight queue as cards — pending wears the amber hourglass
/// + badge, declined the red one — each tapping through to its status screen.
class _ApplicationsStrip extends ConsumerWidget {
  const _ApplicationsStrip({required this.clientId});

  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(loanRequestsByClientProvider(clientId));

    return async.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 6),
        child: Skeleton(width: double.infinity, height: 58, radius: 15),
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (requests) {
        final pending = requests
            .where((r) => r.status == LoanRequestStatus.pending)
            .take(2)
            .toList();
        if (pending.isEmpty) return const SizedBox.shrink();

        return Column(
          children: [
            for (final r in pending)
              Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: _HomeCard(
                  title: 'Application under review',
                  subtitle:
                      '${Fmt.money(r.amount)} · submitted ${_ago(r.requestedAt)}',
                  leading: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: const Color(0xFFFDF3E0),
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: const Icon(
                      Icons.hourglass_top_rounded,
                      size: 16,
                      color: Color(0xFFB26A00),
                    ),
                  ),
                  trailing: const AppBadge(
                    'Pending',
                    variant: BadgeVariant.amber,
                    fontSize: 9,
                  ),
                  onTap: () => context.push('/c/request-status/${r.id}'),
                ),
              ),
          ],
        );
      },
    );
  }
}

class AppBadge extends StatelessWidget {
  const AppBadge(this.label, {super.key, this.variant = BadgeVariant.blue, this.fontSize = 9});

  final String label;
  final BadgeVariant variant;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = _variantColors(variant);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: fontSize,
          fontWeight: FontWeight.w800,
          color: fg,
        ),
      ),
    );
  }
}

enum BadgeVariant { green, amber, red, blue }

(Color, Color) _variantColors(BadgeVariant variant) => switch (variant) {
  BadgeVariant.green => (AppColors.green50, AppColors.green700),
  BadgeVariant.amber => (AppColors.amber50, const Color(0xFFB26A00)),
  BadgeVariant.red => (AppColors.red50, const Color(0xFFC03538)),
  BadgeVariant.blue => (AppColors.blue50, AppColors.blue600),
};

String _ago(DateTime t) {
  final diff = DateTime.now().difference(t);
  if (diff.inMinutes < 60) return '${diff.inMinutes.clamp(1, 59)}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'yesterday';
  return '${diff.inDays}d ago';
}

// ---------- recent activity ----------

class _ActivityStrip extends ConsumerWidget {
  const _ActivityStrip({required this.role});

  final String role;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(notificationsProvider(role));

    return async.when(
      loading: () => const Column(
        children: [
          Skeleton(width: double.infinity, height: 40, radius: 12),
          SizedBox(height: 7),
          Skeleton(width: double.infinity, height: 40, radius: 12),
        ],
      ),
      error: (_, _) => const SizedBox.shrink(),
      data: (items) {
        if (items.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(
              title: 'Recent activity',
              onSeeAll: () => context.go('/c/alerts'),
            ),
            const SizedBox(height: 7),
            for (final n in items.take(2)) _ActivityRow(notification: n),
          ],
        );
      },
    );
  }
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.notification});

  final AppNotification notification;

  @override
  Widget build(BuildContext context) {
    final fg = _fgFor(notification.type);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: fg.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(_iconFor(notification.type), size: 15, color: fg),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  notification.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_timeAgo(notification.time)} · ${notification.body}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.muted,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

IconData _iconFor(NotificationType type) => switch (type) {
      NotificationType.paymentDue => Icons.alarm_rounded,
      NotificationType.paymentReceived => Icons.check_rounded,
      NotificationType.loanOverdue => Icons.error_rounded,
      NotificationType.verification => Icons.verified_rounded,
      NotificationType.clientActivity => Icons.person_outline_rounded,
      NotificationType.loanRequest => Icons.send_rounded,
      NotificationType.requestApproved => Icons.celebration_outlined,
      NotificationType.requestRejected => Icons.close_rounded,
      NotificationType.system => Icons.info_rounded,
    };

Color _fgFor(NotificationType type) => switch (type) {
      NotificationType.paymentDue => const Color(0xFFB26A00),
      NotificationType.paymentReceived => AppColors.green700,
      NotificationType.loanOverdue => AppColors.red,
      NotificationType.verification => AppColors.blue600,
      NotificationType.clientActivity => AppColors.blue600,
      NotificationType.loanRequest => AppColors.blue600,
      NotificationType.requestApproved => AppColors.green700,
      NotificationType.requestRejected => AppColors.red,
      NotificationType.system => AppColors.muted,
    };

String _timeAgo(DateTime then) {
  final diff = DateTime.now().difference(then);
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays == 1) return 'yesterday';
  return '${diff.inDays}d ago';
}

// ---------- loading / error ----------

class _RefreshGrid extends StatelessWidget {
  const _RefreshGrid({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 80),
      children: [child],
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(width: double.infinity, height: 46, radius: 14),
          SizedBox(height: 10),
          Skeleton(width: double.infinity, height: 150, radius: 20),
          SizedBox(height: 12),
          SkeletonCard(showBadge: true),
          SizedBox(height: 9),
          SkeletonCard(showBadge: true),
          SizedBox(height: 9),
          SkeletonCard(showBadge: true),
        ],
      ),
    );
  }
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 90),
      children: [
        const Icon(
          Icons.cloud_off_outlined,
          size: 44,
          color: AppColors.muted,
        ),
        const SizedBox(height: 14),
        Center(child: Text(message)),
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: onRetry,
          child: const Text('Retry'),
        ),
      ],
    );
  }
}

// ---------- home limit provider ----------

final _homeLimitProvider = FutureProvider.autoDispose<_HomeLimit?>((ref) async {
  final session = ref.watch(authControllerProvider).session;
  final userId = session?.userId;
  if (userId == null) return null;

  // The lender-settings feed is the branding authority used by the loan
  // detail header. It also keeps the Home hero available for clients whose
  // completed loans no longer appear in the historical "linked lenders" list.
  final gate = ref.watch(clientGateProvider).valueOrNull;
  final gateLenders = gate?.lenders ?? const <LenderStatus>[];
  final lenderNames = <String, String>{
    for (final lender in gateLenders) lender.tenantId: lender.name,
  };

  try {
    for (final lender in await ref.watch(linkedLendersProvider(userId).future)) {
      lenderNames.putIfAbsent(lender.id, () => lender.name);
    }
  } catch (_) {
    // A lender surfaced by client settings is still enough to resolve its
    // credit allowance, so an out-of-date linked-lenders list is not fatal.
  }

  // A repaid loan remains a valid lender relationship. Use its tenant id if
  // the relationship feeds above are delayed.
  for (final loan in await ref.watch(clientLoansProvider.future)) {
    final tenantId = loan.tenantId;
    if (tenantId != null && tenantId.isNotEmpty) {
      lenderNames.putIfAbsent(tenantId, () => loan.lenderName);
    }
  }

  // The application card on this very screen is also a direct lender
  // relationship. Some older loan records predate `tenantId`, but requests
  // always carry the lender id used by the credit-limit endpoint.
  for (final request
      in await ref.watch(loanRequestsByClientProvider(userId).future)) {
    if (request.lenderId.isNotEmpty) {
      lenderNames.putIfAbsent(request.lenderId, () => request.lenderName);
    }
  }

  _HomeLimit? best;
  for (final entry in lenderNames.entries) {
    try {
      final limit = await ref.read(
        creditLimitProvider((clientId: userId, lenderId: entry.key)).future,
      );
      if (limit.limitKwacha <= 0 || limit.blockedReason != null) continue;
      if (best == null || limit.limitKwacha > best.limitKwacha) {
        best = _HomeLimit(
          limitKwacha: limit.limitKwacha,
          tier: limit.tier,
          lenderName: entry.value,
          nextTier: limit.nextTier,
          tenantId: entry.key,
        );
      }
    } catch (_) {
      // Do not lose a lender-branded Home banner because another lender's
      // policy has not been published or cannot be reached.
    }
  }
  return best;
});

class _HomeLimit {
  const _HomeLimit({
    required this.limitKwacha,
    required this.tier,
    required this.lenderName,
    required this.nextTier,
    this.tenantId,
  });

  final double limitKwacha;
  final String tier;
  final String lenderName;
  final CreditNextTier? nextTier;
  final String? tenantId;
}
