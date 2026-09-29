import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';

/// A lender with its own resolved limit + product terms for THIS client.
class _LenderLimit {
  const _LenderLimit({
    required this.id,
    required this.name,
    required this.limitKwacha,
    required this.tier,
    required this.maxTermMonths,
    required this.ratePct,
    required this.feePct,
    required this.productMaxTerm,
    this.blockedReason,
  });

  /// Fallback when a lender can't be resolved (e.g. not linked to the client).
  const _LenderLimit.failed(String id, String name, String reason)
    : this(
        id: id,
        name: name,
        limitKwacha: 0,
        tier: '',
        maxTermMonths: 0,
        ratePct: 0,
        feePct: 0,
        productMaxTerm: 12,
        blockedReason: reason,
      );

  final String id;
  final String name;
  final double limitKwacha;
  final String tier;
  final int maxTermMonths;
  final double ratePct;
  final double feePct;
  final int productMaxTerm;
  final String? blockedReason;

  bool get blocked => blockedReason != null;
}

/// Resolves the per-lender limit + product terms in one round of calls. The
/// ladder is computed server-side; the app only displays it.
final _applyLimitsProvider = FutureProvider.autoDispose
    .family<List<_LenderLimit>, String>((ref, clientId) async {
      final lenders = await ref.watch(linkedLendersProvider(clientId).future);
      final repo = ref.read(loanRequestsRepositoryProvider);
      final out = <_LenderLimit>[];
      for (final l in lenders) {
        try {
          final limit = await repo.creditLimit(clientId, lenderId: l.id);
          final terms = await repo.productTerms(l.id);
          out.add(
            _LenderLimit(
              id: l.id,
              name: l.name,
              limitKwacha: limit.limitKwacha,
              tier: limit.tier,
              maxTermMonths: limit.maxTermMonths,
              blockedReason: limit.blockedReason,
              ratePct: terms?.ratePct ?? 15,
              feePct: terms?.feePct ?? 0,
              productMaxTerm: terms?.maxTermMonths ?? 12,
            ),
          );
        } on ApiException catch (e) {
          out.add(_LenderLimit.failed(l.id, l.name, e.message));
        } on DioException catch (e) {
          out.add(
            _LenderLimit.failed(l.id, l.name, ApiException.fromDio(e).message),
          );
        }
      }
      return out;
    });

class ClientRequestLoanScreen extends ConsumerStatefulWidget {
  const ClientRequestLoanScreen({super.key});

  @override
  ConsumerState<ClientRequestLoanScreen> createState() =>
      _ClientRequestLoanScreenState();
}

class _ClientRequestLoanScreenState
    extends ConsumerState<ClientRequestLoanScreen> {
  static const _minAmount = 100.0;

  final _purposeCtrl = TextEditingController();
  String? _lenderId;
  double _amount = 1000;
  int _termMonths = 2;
  var _submitting = false;

  @override
  void dispose() {
    _purposeCtrl.dispose();
    super.dispose();
  }

  int _maxTermFor(_LenderLimit l) {
    final cap = l.maxTermMonths < l.productMaxTerm
        ? l.maxTermMonths
        : l.productMaxTerm;
    return cap < 1 ? 1 : cap;
  }

  _LenderLimit? _selected(List<_LenderLimit> limits) {
    final active = limits.where((l) => !l.blocked).toList();
    if (_lenderId != null) {
      for (final l in limits) {
        if (l.id == _lenderId) return l;
      }
    }
    if (active.isNotEmpty) return active.first;
    return limits.isNotEmpty ? limits.first : null;
  }

  Future<void> _submit(WidgetRef ref, _LenderLimit lender) async {
    final purpose = _purposeCtrl.text.trim();
    if (purpose.length < 3) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add a short description of what the loan is for'),
        ),
      );
      return;
    }
    final session = ref.read(authControllerProvider).session;
    if (session == null) return;

    final maxTerm = _maxTermFor(lender);
    final maxAmount = lender.limitKwacha < _minAmount
        ? _minAmount
        : lender.limitKwacha;
    final amount = _amount.clamp(_minAmount, maxAmount).toDouble();
    final term = _termMonths > maxTerm ? maxTerm : _termMonths;

    setState(() => _submitting = true);
    try {
      await ref
          .read(loanRequestsRepositoryProvider)
          .create(
            clientId: session.userId,
            clientName: session.displayName,
            lenderId: lender.id,
            lenderName: lender.name,
            amount: amount,
            termInstallments: term,
            purpose: purpose,
          );
      if (!mounted) return;
      // The applications strip + history refresh; the home hero already
      // defaults to the under-review card the moment a pending request exists.
      ref.invalidate(loanRequestsByClientProvider(session.userId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Application sent. Your lender will review it'),
        ),
      );
      context.pop();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(e.message)));
    } on DioException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(ApiException.fromDio(e).message)));
    } catch (e) {
      if (!mounted) return;
      final raw = e
          .toString()
          .replaceFirst(RegExp(r'^.*Exception: '), '')
          .trim();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            raw.isEmpty ? 'Request failed. Please try again.' : raw,
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    if (session == null) return const SizedBox.shrink();
    final limitsAsync = ref.watch(_applyLimitsProvider(session.userId));

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: limitsAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                Skeleton(width: double.infinity, height: 120, radius: 20),
                SizedBox(height: 14),
                Skeleton(width: double.infinity, height: 40, radius: 16),
                SizedBox(height: 14),
                Skeleton(width: double.infinity, height: 130, radius: 16),
                SizedBox(height: 14),
                Skeleton(width: double.infinity, height: 52, radius: 14),
              ],
            ),
          ),
          error: (_, _) => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('Could not load your lenders'),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () =>
                      ref.invalidate(_applyLimitsProvider(session.userId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (limits) => _buildForm(ref, limits),
        ),
      ),
    );
  }

  Widget _buildForm(WidgetRef ref, List<_LenderLimit> limits) {
    final active = limits.where((l) => !l.blocked).toList();
    final selected = _selected(limits);
    final hasLimit = selected != null && !selected.blocked;
    final sliderMax = hasLimit && selected.limitKwacha >= _minAmount
        ? selected.limitKwacha
        : _minAmount * 2;
    final displayedMax = hasLimit ? selected.limitKwacha : _minAmount;
    final clampedAmount = _amount.clamp(_minAmount, sliderMax).toDouble();
    final maxTerm = selected == null ? 1 : _maxTermFor(selected);
    final clampedTerm = _termMonths > maxTerm ? maxTerm : _termMonths;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
      children: [
        Text(
          'Apply for Loan',
          style: GoogleFonts.poppins(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.4,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(height: 5),
        if (selected != null && hasLimit) ...[
          Text.rich(
            TextSpan(
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
              children: [
                const TextSpan(text: 'Available limit: '),
                TextSpan(
                  text: Fmt.money(selected.limitKwacha),
                  style: const TextStyle(
                    color: AppColors.blue600,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (selected.tier.isNotEmpty)
                  TextSpan(
                    text: '  ·  ${selected.tier}',
                    style: const TextStyle(
                      color: AppColors.green700,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
        ],

        // ── lender picker: only when more than one applicable lender ──
        if (active.length > 1) ...[
          const SizedBox(height: 16),
          const Text(
            'Choose your lender',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.muted,
            ),
          ),
          const SizedBox(height: 8),
          for (final l in limits)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _LenderCard(
                lender: l,
                selected: l.id == (selected?.id),
                onTap: l.blocked
                    ? null
                    : () => setState(() {
                        _lenderId = l.id;
                        final cap = _maxTermFor(l);
                        _amount = _amount
                            .clamp(_minAmount, l.limitKwacha)
                            .toDouble();
                        _termMonths = _termMonths > cap ? cap : _termMonths;
                      }),
              ),
            ),
        ],

        // ── amount hero + slider (banner holds the number; slider below) ──
        const SizedBox(height: 16),
        _AmountHero(
          amount: clampedAmount,
          min: _minAmount,
          max: sliderMax,
          displayMax: displayedMax,
          enabled: hasLimit,
          onChanged: (v) => setState(() {
            _amount = (v / 10).roundToDouble() * 10;
            if (_amount > sliderMax) _amount = sliderMax;
            if (_amount < _minAmount) _amount = _minAmount;
          }),
        ),

        // ── repayment period (capped by the tier + product) ──
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'Repayment period',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            Text(
              '$clampedTerm month${clampedTerm == 1 ? '' : 's'}',
              style: GoogleFonts.poppins(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: AppColors.blue600,
              ),
            ),
          ],
        ),
        Slider(
          value: clampedTerm.toDouble(),
          min: 1,
          max: maxTerm.toDouble(),
          divisions: maxTerm > 1 ? maxTerm - 1 : 1,
          label: '$clampedTerm mo',
          activeColor: AppColors.blue600,
          onChanged: hasLimit
              ? (v) => setState(() => _termMonths = v.round())
              : null,
        ),

        // ── live breakdown ──
        const SizedBox(height: 16),
        if (selected != null)
          _Breakdown(
            principal: clampedAmount,
            ratePct: selected.ratePct,
            feePct: selected.feePct,
            termMonths: clampedTerm,
          ),

        const SizedBox(height: 16),
        TextField(
          controller: _purposeCtrl,
          maxLines: 2,
          enabled: !_submitting,
          decoration: InputDecoration(
            hintText: 'What is the loan for? e.g. Restock shop inventory',
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(13),
              borderSide: const BorderSide(color: AppColors.line),
            ),
          ),
          style: const TextStyle(fontSize: 12.5),
        ),

        if (selected?.blocked ?? false) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.amber50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFF3DCB3)),
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.block_rounded,
                  size: 17,
                  color: Color(0xFFB26A00),
                ),
                const SizedBox(width: 9),
                Expanded(
                  child: Text(
                    selected!.blockedReason!,
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFF7A5200),
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 14),

        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.blue600,
            minimumSize: const Size.fromHeight(52),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          onPressed: (_submitting || selected == null || selected.blocked)
              ? null
              : () => _submit(ref, selected),
          child: _submitting
              ? const ButtonSpinner()
              : const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Submit Application',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(width: 7),
                    Icon(Icons.arrow_forward_rounded, size: 16),
                  ],
                ),
        ),

        // ── approval process strip ──
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: AppColors.blue50,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFDCE7FB)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.verified_outlined,
                    size: 13,
                    color: AppColors.blue600,
                  ),
                  SizedBox(width: 5),
                  Text(
                    'APPROVAL PROCESS',
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w800,
                      letterSpacing: .12,
                      color: AppColors.blue600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  _step(1, 'Submit', AppColors.blue600),
                  const _StepArrow(),
                  _step(2, 'Lender review', const Color(0xFF5B8DEF)),
                  const _StepArrow(),
                  _step(3, 'Loan active\n& repay', AppColors.green500),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _step(int n, String label, Color color) => Expanded(
    child: Column(
      children: [
        Container(
          width: 20,
          height: 20,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: Center(
            child: Text(
              '$n',
              style: const TextStyle(
                fontSize: 9.5,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        ),
        const SizedBox(height: 5),
        Text(
          label,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 8.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink2,
            height: 1.3,
          ),
        ),
      ],
    ),
  );
}

class _StepArrow extends StatelessWidget {
  const _StepArrow();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(top: 6),
      child: Icon(
        Icons.chevron_right_rounded,
        size: 14,
        color: Color(0xFFB9C6E8),
      ),
    );
  }
}

/// Giant draggable amount: a gradient banner holding only the number, with the
/// slider + Min/Max labels on the page background below it.
class _AmountHero extends StatelessWidget {
  const _AmountHero({
    required this.amount,
    required this.min,
    required this.max,
    required this.displayMax,
    required this.enabled,
    required this.onChanged,
  });

  final double amount;
  final double min;
  final double max;
  final double displayMax;
  final bool enabled;
  final ValueChanged<double> onChanged;

  @override
  Widget build(BuildContext context) {
    final label = Fmt.money(amount);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // ── gradient banner: the amount only ──
        Container(
          padding: const EdgeInsets.fromLTRB(18, 22, 18, 20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [AppColors.blue600, AppColors.blue900],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            children: [
              const Text(
                'SELECT LOAN AMOUNT',
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .18,
                  color: Color(0xFFAFC3EE),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    'K ',
                    style: GoogleFonts.poppins(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF9FB4E4),
                    ),
                  ),
                  Text(
                    label.substring(2),
                    style: GoogleFonts.poppins(
                      fontSize: 44,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                      letterSpacing: -1.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              const Text(
                'Drag the slider below to adjust',
                style: TextStyle(fontSize: 10.5, color: Color(0xFF8FA8DE)),
              ),
            ],
          ),
        ),

        // ── slider: BELOW the banner, on the page background ──
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: AppColors.green500,
              inactiveTrackColor: const Color(0xFFE3E8F2),
              thumbColor: AppColors.green500,
              overlayColor: AppColors.green500.withValues(alpha: .15),
              thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 13),
              trackHeight: 6,
            ),
            child: Slider(
              value: amount.clamp(min, max),
              min: min,
              max: max,
              onChanged: enabled ? onChanged : null,
            ),
          ),
        ),

        // ── min/max labels below the slider, dark text like the reference ──
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Min: ${Fmt.money(min)}',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink2,
                ),
              ),
              Text(
                'Max: ${Fmt.money(displayMax)}',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink2,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// A lender choice with its own limit + tier (or the block reason).
class _LenderCard extends StatelessWidget {
  const _LenderCard({
    required this.lender,
    required this.selected,
    required this.onTap,
  });

  final _LenderLimit lender;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(11),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFF7F9FF) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.blue600 : AppColors.line,
            width: selected ? 1.5 : 1,
          ),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: AppColors.blue600.withValues(alpha: .07),
                    blurRadius: 10,
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: lender.blocked
                      ? const [Color(0xFFB26A00), Color(0xFF8a5000)]
                      : const [AppColors.blue500, AppColors.blue900],
                ),
                shape: BoxShape.circle,
              ),
              child: Text(
                Fmt.initials(lender.name),
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lender.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    lender.blocked
                        ? lender.blockedReason!
                        : '${Fmt.money(lender.limitKwacha)} limit'
                              '${lender.tier.isEmpty ? '' : ' · ${lender.tier}'}',
                    style: TextStyle(
                      fontSize: 10,
                      color: lender.blocked
                          ? const Color(0xFFB26A00)
                          : AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 19,
              height: 19,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? AppColors.blue600 : Colors.transparent,
                border: Border.all(
                  color: selected ? AppColors.blue600 : const Color(0xFFC9D2E4),
                  width: 2,
                ),
              ),
              child: selected
                  ? const Icon(
                      Icons.check_rounded,
                      size: 11,
                      color: Colors.white,
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// Reconciles principal + interest + fee = total — the figure the client is
/// committing to, shown before they tap submit.
class _Breakdown extends StatelessWidget {
  const _Breakdown({
    required this.principal,
    required this.ratePct,
    required this.feePct,
    required this.termMonths,
  });

  final double principal;
  final double ratePct;
  final double feePct;
  final int termMonths;

  String get _rateLabel {
    final whole = ratePct % 1 == 0;
    return whole ? ratePct.round().toString() : ratePct.toStringAsFixed(1);
  }

  @override
  Widget build(BuildContext context) {
    final interest = principal * ratePct / 100;
    final fee = principal * feePct / 100;
    final total = principal + interest + fee;

    Widget row(String label, String value, {bool total = false}) => Container(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 11),
      decoration: BoxDecoration(
        color: total ? AppColors.amber50 : Colors.white,
        border: total
            ? null
            : Border(bottom: BorderSide(color: Colors.grey.shade100)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: total ? FontWeight.w800 : FontWeight.w500,
              color: total ? AppColors.amber : AppColors.ink2,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: total ? 14 : 12,
              fontWeight: FontWeight.w700,
              color: total ? AppColors.amber : AppColors.ink,
            ),
          ),
        ],
      ),
    );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 9),
            color: const Color(0xFFFFFCF5),
            child: const Row(
              children: [
                Icon(
                  Icons.request_quote_rounded,
                  size: 12,
                  color: AppColors.amber,
                ),
                SizedBox(width: 5),
                Text(
                  'LOAN BREAKDOWN',
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: .14,
                    color: AppColors.amber,
                  ),
                ),
              ],
            ),
          ),
          row('Principal amount', Fmt.money(principal)),
          row(
            'Interest ($_rateLabel% · '
            '$termMonths ${termMonths == 1 ? 'month' : 'months'})',
            Fmt.money(interest),
          ),
          row('Processing fee', Fmt.money(fee)),
          row('Total due at maturity', Fmt.money(total), total: true),
        ],
      ),
    );
  }
}
