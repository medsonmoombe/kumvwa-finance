import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
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
          detail: describeApiError(e),
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
      backgroundColor: AppColors.card,
      body: SafeArea(child: body),
    );
  }
}

/// Domed gradient header matching HTML .dome — contains the appbar row
/// (.appbar) and the hero balance block (.hero).
class _HomeDome extends ConsumerWidget {
  const _HomeDome({required this.session});

  final UserSession session;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref
            .watch(notificationsProvider(session.role))
            .valueOrNull
            ?.where((n) => !n.read)
            .length ??
        0;

    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppGradients.dome),
      child: Stack(
        children: [
                Positioned(
                  right: -60,
                  top: -90,
                  child: Container(
                    width: 190,
                    height: 190,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.09),
                    ),
                  ),
                ),
                Positioned(
                  left: -44,
                  bottom: -30,
                  child: Container(
                    width: 130,
                    height: 130,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.07),
                    ),
                  ),
                ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                      Row(
                        children: [
                          Container(
                            width: 34,
                            height: 34,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.16),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.grid_view_rounded,
                              size: 17,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 11),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _greeting().toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.6,
                                    color: Color(0xA8FFFFFF),
                                  ),
                                ),
                                Text(
                                  session.displayName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.poppins(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          GestureDetector(
                            onTap: () => context.go('/c/profile'),
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Container(
                                  width: 38,
                                  height: 38,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.white.withValues(alpha: 0.18),
                                    border: Border.all(
                                      color: Colors.white.withValues(alpha: 0.4),
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Text(
                                    Fmt.initials(session.displayName),
                                    style: GoogleFonts.poppins(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                if (unread > 0)
                                  Positioned(
                                    right: -1,
                                    bottom: -1,
                                    child: GestureDetector(
                                      onTap: () => context.go('/c/alerts'),
                                      child: Container(
                                        width: 14,
                                        height: 14,
                                        alignment: Alignment.center,
                                        decoration: BoxDecoration(
                                          color: AppColors.red,
                                          shape: BoxShape.circle,
                                          border: Border.all(
                                            color: Colors.white,
                                            width: 1.5,
                                          ),
                                        ),
                                        child: Text(
                                          unread > 9 ? '9+' : '$unread',
                                          style: const TextStyle(
                                            fontSize: 7,
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                else
                                  Positioned(
                                    right: -1,
                                    bottom: -1,
                                    child: Container(
                                      width: 11,
                                      height: 11,
                                      decoration: BoxDecoration(
                                        color: AppColors.green500,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Colors.white,
                                          width: 2,
                                        ),
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      const _HeroSection(),
              ],
            ),
          ),
        ],
      ),
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
                style: AppText.pageTitle,
              ),
              const SizedBox(height: 8),
              const Text(
                'Please read and accept the Kumvwa Finance Terms of Service to continue.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  color: AppColors.muted,
                  height: 1.5,
                ),
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
              FilledButton(
                onPressed: _busy ? null : _accept,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.blue600,
                  minimumSize: const Size.fromHeight(AppSizes.button),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.button),
                  ),
                ),
                child: _busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'I Accept the Terms',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
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

  final ClientGateState? gate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loansAsync = ref.watch(clientLoansProvider);
    final session = ref.watch(authControllerProvider).session;
    final clientId = session?.userId ?? '';

    return loansAsync.when(
      loading: () => const _RefreshGrid(child: _LoadingView()),
      error: (e, _) => _RefreshGrid(
        child: _ErrorRetry(
          message: 'Could not load your loans',
          detail: describeApiError(e),
          onRetry: () => ref.invalidate(clientLoansProvider),
        ),
      ),
      data: (loans) => _Body(loans: loans, gate: gate),
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

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(clientLoansProvider);
        ref.invalidate(loanRequestsByClientProvider(clientId));
        ref.invalidate(_homeLimitProvider);
        ref.invalidate(notificationsProvider(session.role));
        ref.invalidate(clientGateProvider);
      },
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        children: [
          // Dome scrolls with content
          _HomeDome(session: session),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 90),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _ActionButtons(loans: loans),
                const SizedBox(height: 4),
                if (gate?.registration.owesThenRegisters ?? false)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _RegistrationPendingCard(decision: gate!.registration),
                  ),
                const SizedBox(height: 12),
                _ApplicationsStrip(clientId: clientId),
                for (final l in gate?.lenders.where((l) => !l.termsAccepted) ?? const <LenderStatus>[])
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
                        child: const Icon(Icons.description_outlined, size: 16, color: Color(0xFFB26A00)),
                      ),
                      trailing: const Icon(Icons.chevron_right_rounded, size: 18, color: Color(0xFFB26A00)),
                      backgroundColor: const Color(0xFFFDF3E0),
                      onTap: () => showTenantTermsSheet(context, ref, l),
                    ),
                  ),
                const SizedBox(height: 14),
                _SectionHeader(
                  title: 'Recent Transaction',
                  onSeeAll: () => context.go('/c/history'),
                ),
                const SizedBox(height: 7),
                _ActivityStrip(role: session.role),
              ],
            ),
          ),
        ],
      ),
    );
  }
}


// ---------- state hero ----------

/// Hero balance block inside the dome — matches HTML .hero.
/// Shows loan balance (if active loan) or available limit.
class _HeroSection extends ConsumerWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loans = ref.watch(clientLoansProvider).valueOrNull ?? const <Loan>[];
    final activeLoan = loans.where((l) => l.nextInstallment != null).toList();
    if (activeLoan.isNotEmpty) {
      activeLoan.sort(
        (a, b) => a.nextInstallment!.dueDate.compareTo(
          b.nextInstallment!.dueDate,
        ),
      );
      final loan = activeLoan.first;
      final next = loan.nextInstallment!;
      return _HeroDomeContent(
        label: 'Loan balance',
        amount: loan.outstanding,
        sub:
            'Next payment ${Fmt.money(next.remaining)} · due ${Fmt.date(next.dueDate)}',
        onTap: () => showPaySheet(context, ref, loan),
      );
    }

    return ref.watch(_homeLimitProvider).when(
      loading: () => const _HeroDomeContent(
        label: 'Available limit',
        amount: 0,
        sub: 'Loading…',
      ),
      error: (_, _) => const _HeroDomeContent(
        label: 'Available limit',
        amount: 0,
        sub: 'You can borrow up to · Building trust',
      ),
      data: (limit) => _HeroDomeContent(
        label: limit == null ? 'Available limit' : 'Available limit',
        amount: limit?.limitKwacha ?? 0,
        sub: limit == null
            ? 'You can borrow up to · Building trust'
            : 'You can borrow up to · ${limit.lenderName}',
        onTap: limit != null ? () => context.push('/c/request') : null,
      ),
    );
  }
}

/// The dome's central balance display — matches HTML .hero block.
class _HeroDomeContent extends StatelessWidget {
  const _HeroDomeContent({
    required this.label,
    required this.amount,
    required this.sub,
    this.onTap,
  });

  final String label;
  final double amount;
  final String sub;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final n = NumberFormat.decimalPattern()
      ..maximumFractionDigits = 2
      ..minimumFractionDigits = 2;
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 9.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.8,
              color: Color(0xA8FFFFFF),
            ),
          ),
          const SizedBox(height: 4),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: 'K ',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF9FB4E4).withValues(alpha: 0.9),
                  ),
                ),
                TextSpan(
                  text: n.format(amount),
                  style: GoogleFonts.poppins(
                    fontSize: 32,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.6,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 3),
          Text(
            sub,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Color(0xC7FFFFFF),
            ),
          ),
        ],
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
              if (leading != null) ...[leading!, const SizedBox(width: 10)],
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
          style: GoogleFonts.poppins(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
          ),
        ),
        const Spacer(),
        if (onSeeAll != null)
          GestureDetector(
            onTap: onSeeAll,
            child: const Text(
              'See all',
              style: TextStyle(
                fontSize: 11,
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
  const AppBadge(
    this.label, {
    super.key,
    this.variant = BadgeVariant.blue,
    this.fontSize = 9,
  });

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
            for (final n in items.take(4)) _ActivityRow(notification: n),
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
                  style: const TextStyle(fontSize: 11, color: AppColors.muted),
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

// ---------- conditional action buttons ----------

class _ActionButtons extends ConsumerWidget {
  const _ActionButtons({required this.loans});
  final List<Loan> loans;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final active = loans.where((l) => l.nextInstallment != null).toList()
      ..sort((a, b) =>
          a.nextInstallment!.dueDate.compareTo(b.nextInstallment!.dueDate));
    final hasActive = active.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          if (hasActive) ...[
            Expanded(
              child: _HomeActionBtn(
                icon: Icons.north_east_rounded,
                label: 'Repay',
                green: true,
                onTap: () => showPaySheet(context, ref, active.first),
              ),
            ),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: _HomeActionBtn(
              icon: Icons.add_rounded,
              label: 'Apply',
              green: false,
              onTap: () => context.push('/c/request'),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeActionBtn extends StatelessWidget {
  const _HomeActionBtn({
    required this.icon,
    required this.label,
    required this.green,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool green;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: AppSizes.button,
        decoration: BoxDecoration(
          gradient: green ? AppGradients.green : AppGradients.brand,
          borderRadius: BorderRadius.circular(AppRadii.button),
          boxShadow: green ? AppShadows.shActionGreen : AppShadows.shAction,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: Colors.white),
            const SizedBox(width: 7),
            Text(
              label,
              style: GoogleFonts.poppins(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
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
  const _ErrorRetry({
    required this.message,
    required this.onRetry,
    this.detail,
  });

  final String message;
  final VoidCallback onRetry;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 68,
              height: 68,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: AppColors.red50,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.redLine, width: 1.5),
              ),
              child: const Icon(
                Icons.cloud_off_rounded,
                size: 30,
                color: AppColors.red,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              style: const TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
              textAlign: TextAlign.center,
            ),
            if (detail != null) ...[
              const SizedBox(height: 6),
              Text(
                detail!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 11, color: AppColors.muted),
              ),
            ],
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: const Text('Retry'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.blue600,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.button),
                ),
              ),
            ),
          ],
        ),
      ),
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
    for (final lender in await ref.watch(
      linkedLendersProvider(userId).future,
    )) {
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
  for (final request in await ref.watch(
    loanRequestsByClientProvider(userId).future,
  )) {
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
