import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/provider_logo.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/payments/data/payments_repository.dart';
import 'package:kumvwa_finance/features/payments/domain/payment_intent.dart';

enum _Stage {
  select,
  confirm,
  processing,
  success,
  bankDetails,
  bankSent,
  failed,
}

/// 097/077/057 → Airtel, 096/056/076 → MTN, 095 → Zamtel, else → MTN.
PayProvider _detectProvider(String phone) {
  final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  final local = digits.startsWith('260') ? digits.substring(3) : digits;
  if (local.startsWith('97') || local.startsWith('77') || local.startsWith('57')) return PayProvider.airtelMoney;
  if (local.startsWith('95')) return PayProvider.zamtelKwacha;
  return PayProvider.mtnMomo; // 96/56/76 and fallback
}

String _maskedPhone(String phone) {
  final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.length < 4) return phone;
  return '+260 ···· ${digits.substring(digits.length - 4)}';
}

class _MethodRow {
  const _MethodRow(this.method, this.detail, {required this.instant});
  final PayProvider method;
  final String detail;
  final bool instant;
}

Future<void> showPaySheet(
  BuildContext context,
  WidgetRef ref,
  Loan loan,
) async {
  final next = loan.nextInstallment;
  if (next == null) return;

  final theme = lenderTheme(ref, loan.tenantId);
  final interestShare =
      loan.principal * loan.interestRatePct / 100 / loan.termInstallments;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetCtx) => _PaySheet(
      loan: loan,
      amount: next.remaining,
      interestShare: interestShare,
      theme: theme,
    ),
  );

  /// Refresh every provider that shows loan state.
  ref.invalidate(clientLoansProvider);
  ref.invalidate(loansProvider);
  ref.invalidate(loanByIdProvider(loan.id));
  // Settling the last instalment is what releases a borrower who owes
  // registration — the gate has to be re-judged, not just the loan list.
  ref.invalidate(clientGateProvider);
  // A payment changed the receipts list.
  ref.invalidate(paymentReceiptsProvider);
}

class _PaySheet extends ConsumerStatefulWidget {
  const _PaySheet({
    required this.loan,
    required this.amount,
    required this.interestShare,
    required this.theme,
  });

  final Loan loan;
  final double amount;
  final double interestShare;
  final LenderTheme theme;

  @override
  ConsumerState<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends ConsumerState<_PaySheet> {
  _Stage _stage = _Stage.select;
  late PayProvider _method;
  late String _phone;
  late final TextEditingController _amountCtrl = TextEditingController(
    text: widget.amount.toStringAsFixed(2),
  );

  Timer? _timer;
  int _secondsLeft = 60;
  bool _apiDone = false;
  bool _busy = false;
  String? _failureMsg;

  /// The live charge. Its `reference` is what the borrower is shown on success
  /// — the API mints it, so the number on screen is the one the ledger and the
  /// lender's console hold.
  PaymentIntent? _intent;

  @override
  void initState() {
    super.initState();
    final session = ref.read(authControllerProvider).session;
    _phone = session?.phone ?? '';
    _method = _detectProvider(_phone);
  }

  List<_MethodRow> get _rows => [
    _MethodRow(_method, '${_maskedPhone(_phone)} · PIN on your phone', instant: true),
    const _MethodRow(PayProvider.bank, 'Bank transfer · lender confirms', instant: false),
  ];

  @override
  void dispose() {
    _timer?.cancel();
    _amountCtrl.dispose();
    super.dispose();
  }

  double get _amount => double.tryParse(_amountCtrl.text.trim()) ?? 0;

  PayProvider get _provider => _method;

  // ───────────────────────── actions ─────────────────────────

  /// Ends the in-flight stage on the failure screen, showing [message] when
  /// the server gave us one.
  void _fail(String? message) {
    _timer?.cancel();
    _failureMsg = message;
    if (mounted) setState(() => _stage = _Stage.failed);
  }

  /// Drives one mobile-money payment from intent to a settled verdict.
  ///
  /// The important property here is that **the app never decides a payment
  /// succeeded**. It creates the intent, then asks the API what the provider
  /// said, and only shows the success screen on a server answer of `succeeded`.
  /// A local timer or a hopeful UI transition would let a declined or merely
  /// unapproved charge show a green tick — and the loan balance is only
  /// settled server-side, so the app and the ledger would disagree.
  Future<void> _send() async {
    if (_method == PayProvider.bank) {
      setState(() => _stage = _Stage.bankDetails);
      return;
    }
    setState(() {
      _stage = _Stage.processing;
      _secondsLeft = 60;
      _apiDone = false;
      _failureMsg = null;
      _intent = null;
    });

    final repo = ref.read(paymentsRepositoryProvider);
    try {
      final intent = await repo.payLoan(
        loanId: widget.loan.id,
        amountKwacha: _amount,
        provider: _provider,
      );
      if (!mounted) return;
      setState(() => _intent = intent);

      // A provider that answers synchronously (the sandbox does) needs no
      // polling at all — settle immediately rather than making the borrower
      // stare at a spinner for four seconds.
      if (intent.status.isFinal) {
        _settleFromStatus(intent.status);
        return;
      }

      _startCountdown();
      await _pollUntilFinal(repo, intent.id);
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (_) {
      _fail(null);
    }
  }

  void _startCountdown() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _secondsLeft = 60 - t.tick);
      if (t.tick >= 60) {
        t.cancel();
        // Stopping the countdown is not the same as the payment failing. The
        // charge may still settle later, so say so rather than implying the
        // money is safe to spend.
        _fail(
          'We have not heard back from your provider yet. If you approved the '
          'prompt, the payment will still go through — check your receipts in '
          'a few minutes before trying again.',
        );
      }
    });
  }

  /// Polls the API (which re-syncs against the provider) until the charge
  /// reaches a verdict or the window closes.
  Future<void> _pollUntilFinal(PaymentsRepository repo, String intentId) async {
    for (var attempt = 0; attempt < 10; attempt++) {
      if (!mounted) return;
      await Future<void>.delayed(const Duration(seconds: 3));
      if (!mounted) return;
      try {
        final fresh = await repo.status(intentId);
        if (!mounted) return;
        setState(() => _intent = fresh);
        if (fresh.status.isFinal) {
          _settleFromStatus(fresh.status);
          return;
        }
      } on ApiException catch (e) {
        // One missed poll is not a failure — the charge is still live. Keep
        // trying; the countdown is what gives up.
        if (e.isUnauthorized) {
          _fail(e.message);
          return;
        }
      }
    }
  }

  void _settleFromStatus(PaymentStatus status) {
    _timer?.cancel();
    if (!mounted) return;
    if (status.isPaid) {
      setState(() {
        _apiDone = true;
        _stage = _Stage.success;
      });
    } else {
      setState(() {
        _failureMsg = switch (status) {
          PaymentStatus.failed =>
            'Your provider declined this payment. No money has left your wallet.',
          PaymentStatus.expired =>
            'The payment request expired before it was approved. No money has '
                'left your wallet.',
          PaymentStatus.cancelled => 'Payment cancelled.',
          _ => 'The payment did not complete.',
        };
        _stage = _Stage.failed;
      });
    }
  }

  Future<void> _bankConfirm() async {
    setState(() => _busy = true);
    try {
      await ref
          .read(loansRepositoryProvider)
          .recordPayment(widget.loan.id, amount: _amount);
    } catch (_) {
      // Lender reconciles from the console either way.
    }
    if (mounted) setState(() => _stage = _Stage.bankSent);
  }

  Future<void> _carryOver() async {
    setState(() {
      _stage = _Stage.processing;
      _secondsLeft = 60;
      _apiDone = false;
      _failureMsg = null;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return t.cancel();
      setState(() => _secondsLeft = 60 - t.tick);
      if (t.tick >= 4 && _apiDone) {
        t.cancel();
        setState(() => _stage = _Stage.success);
      }
    });
    try {
      await ref.read(loansRepositoryProvider).rollover(widget.loan.id);
      _apiDone = true;
    } on ApiException catch (e) {
      _fail(e.message);
    } catch (_) {
      _fail(null);
    }
  }

  // ───────────────────────── build ─────────────────────────

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  margin: const EdgeInsets.only(top: 10),
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
              if (_stage == _Stage.select) _select(),
              if (_stage == _Stage.confirm) _confirm(),
              if (_stage == _Stage.processing) _processing(),
              if (_stage == _Stage.success) _success(),
              if (_stage == _Stage.bankDetails) _bankDetails(),
              if (_stage == _Stage.bankSent) _bankSent(),
              if (_stage == _Stage.failed) _failed(),
            ],
          ),
        ),
      ),
    );
  }

  // ───────────────────────── shared pieces ─────────────────────────

  Widget _head(String title, String sub) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 10, 18, 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: GoogleFonts.poppins(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
          ),
        ),
        const SizedBox(height: 2),
        Text(sub, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
      ],
    ),
  );

  Widget _amountCard({String label = "You're paying"}) => Container(
    margin: const EdgeInsets.fromLTRB(16, 0, 16, 10),
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.blue50,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFDCE7FB)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            letterSpacing: .07,
            color: AppColors.blue600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          Fmt.money(_amount, decimals: 2),
          style: GoogleFonts.poppins(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AppColors.blue900,
          ),
        ),
        if (_stage == _Stage.select)
          TextField(
            controller: _amountCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            inputFormatters: [
              FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            ],
            decoration: const InputDecoration(
              isDense: true,
              hintText: 'Adjust amount — partial payments allowed',
              border: InputBorder.none,
              hintStyle: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            style: const TextStyle(fontSize: 12, color: AppColors.muted),
          ),
      ],
    ),
  );

  Widget _brow(String label, String value, {bool isLast = false}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 9),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 12, color: AppColors.muted),
        ),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
            ),
          ),
        ),
      ],
    ),
  );

  Widget _primaryBtn(String label, VoidCallback onTap, {Color? color}) =>
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: color ?? AppColors.green500,
            minimumSize: const Size.fromHeight(50),
          ),
          onPressed: _busy ? null : onTap,
          child: _busy
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: Colors.white,
                  ),
                )
              : Text(
                  label,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
        ),
      );

  Widget _textBtn(String label, VoidCallback onTap, {Color? color}) =>
      TextButton(
        onPressed: onTap,
        child: Text(
          label,
          style: TextStyle(fontSize: 12, color: color ?? AppColors.muted),
        ),
      );

  /// Icon hint card — proper iconography, no emoji.
  Widget _hint({
    required IconData icon,
    required Widget text,
    _HintTone tone = _HintTone.amber,
  }) {
    final (
      Color bg,
      Color border,
      Color fg,
      Color box,
      Color boxFg,
    ) = switch (tone) {
      _HintTone.amber => (
        AppColors.amber50,
        const Color(0xFFF3DCB3),
        const Color(0xFF7A5200),
        const Color(0xFFFCE9C4),
        const Color(0xFFB26A00),
      ),
      _HintTone.blue => (
        AppColors.blue50,
        const Color(0xFFC9D6F0),
        AppColors.blue600,
        const Color(0xFFDCE7FB),
        AppColors.blue600,
      ),
    };

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: box,
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, size: 15, color: boxFg),
          ),
          const SizedBox(width: 10),
          Expanded(child: text),
        ],
      ),
    );
  }

  // ───────────────────────── stage: select ─────────────────────────

  Widget _select() => Column(
    children: [
      _head(
        'Pay ${widget.loan.lenderName}',
        '${widget.loan.id} · installment ${widget.loan.nextInstallment!.number}',
      ),
      _amountCard(),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 2, 16, 0),
        child: Column(
          children: [
            for (final r in _rows) ...[
              GestureDetector(
                onTap: () => setState(() => _method = r.method),
                child: Container(
                  padding: const EdgeInsets.all(11),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: _method == r.method
                        ? const Color(0xFFF7F9FF)
                        : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _method == r.method
                          ? AppColors.blue600
                          : AppColors.line,
                      width: _method == r.method ? 1.5 : 1,
                    ),
                    boxShadow: _method == r.method
                        ? [
                            BoxShadow(
                              color: AppColors.blue600.withValues(alpha: .08),
                              blurRadius: 10,
                            ),
                          ]
                        : null,
                  ),
                  child: Row(
                    children: [
                      ProviderLogo(provider: r.method),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              r.method.label,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: AppColors.ink,
                              ),
                            ),
                            Text(
                              r.detail,
                              style: const TextStyle(
                                fontSize: 12,
                                color: AppColors.muted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: r.instant
                              ? AppColors.green50
                              : const Color(0xFFEEF0F6),
                          borderRadius: BorderRadius.circular(99),
                        ),
                        child: Text(
                          r.instant ? 'Instant' : '1–24 hrs',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: r.instant
                                ? AppColors.green700
                                : AppColors.muted,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        width: 20,
                        height: 20,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _method == r.method
                              ? AppColors.blue600
                              : Colors.transparent,
                          border: Border.all(
                            color: _method == r.method
                                ? AppColors.blue600
                                : const Color(0xFFC9D2E4),
                            width: 2,
                          ),
                        ),
                        child: _method == r.method
                            ? const Icon(
                                Icons.check_rounded,
                                size: 12,
                                color: Colors.white,
                              )
                            : null,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(0, 6, 0, 0),
        child: Column(
          children: [
            _primaryBtn(
              'Send Payment Request',
              () => setState(() => _stage = _Stage.confirm),
            ),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(46),
                  side: const BorderSide(color: AppColors.blue600),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(13),
                  ),
                ),
                onPressed: _busy ? null : _carryOver,
                child: Text(
                  'Pay Interest & Extend +1 month '
                  '(${Fmt.money(widget.interestShare, decimals: 2)})',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 9),
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.shield_outlined, size: 12, color: AppColors.muted),
                SizedBox(width: 5),
                Text(
                  'Your provider may charge a small transaction fee',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
              ],
            ),
            const SizedBox(height: 18),
          ],
        ),
      ),
    ],
  );

  // ───────────────────────── stage: confirm ─────────────────────────

  Widget _confirm() => Column(
    children: [
      _head('Confirm payment', 'Review before we send the request'),
      _amountCard(label: 'Amount'),
      Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.symmetric(horizontal: 15),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            _brow('To', widget.loan.lenderName),
            _brow('Loan', widget.loan.id),
            _brow(
              'Applies to',
              'Installment ${widget.loan.nextInstallment!.number} of '
                  '${widget.loan.termInstallments}',
            ),
            _brow('Paying from', '${_provider.label} ${_maskedPhone(_phone)}'),
            _brow(
              "You'll be asked to",
              'Enter PIN on your phone',
              isLast: true,
            ),
          ],
        ),
      ),
      _hint(
        icon: Icons.lock_rounded,
        text: const Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 12, height: 1.5),
            children: [
              TextSpan(text: 'A payment prompt will appear on your phone. '),
              TextSpan(
                text: 'Never share your PIN',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              TextSpan(text: ' with anyone — including Kumvwa staff.'),
            ],
          ),
        ),
      ),
      _primaryBtn('Send Payment Request', _send),
      _textBtn(
        '← Change method or amount',
        () => setState(() => _stage = _Stage.select),
      ),
      const SizedBox(height: 18),
    ],
  );

  // ───────────────────────── stage: processing ─────────────────────────

  Widget _processing() => Column(
    children: [
      _head('Approve on your phone', 'Waiting for your PIN…'),
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 18),
        child: Column(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                _pulseRing(110, .45),
                _pulseRing(150, .2),
                Container(
                  width: 84,
                  height: 84,
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: Color(0x140F1115), blurRadius: 14),
                    ],
                  ),
                  alignment: Alignment.center,
                  child: ProviderLogo(provider: _provider, size: 54),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Text(
              "We've sent a payment prompt",
              style: GoogleFonts.poppins(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              'Open the request on your phone and enter your '
              '${_provider.label} PIN to approve '
              '${Fmt.money(_amount, decimals: 2)}',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.ink2,
                height: 1.6,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 5),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: AppColors.line),
              ),
              child: Text(
                _maskedPhone(_phone),
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              '0:${_secondsLeft.toString().padLeft(2, '0')}',
              style: GoogleFonts.poppins(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: AppColors.blue600,
              ),
            ),
            const Text(
              'seconds remaining',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: 14),
            _hint(
              icon: Icons.phone_android_rounded,
              text: Text.rich(
                TextSpan(
                  style: const TextStyle(fontSize: 12, height: 1.5),
                  children: [
                    const TextSpan(text: "Can't see the prompt? Open your "),
                    TextSpan(
                      text: _provider.label,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const TextSpan(
                      text:
                          ' app or dial the mobile-money menu, then choose '
                          '"Approve payment".',
                    ),
                  ],
                ),
              ),
            ),
            if (Env.isDev)
              TextButton(
                onPressed: () {
                  // Dev-only: lets a designer see the success screen without
                  // approving a real PIN. It moves the *view* forward and
                  // leaves the payment itself alone — the server is still the
                  // only thing that can mark money paid — so it cannot produce
                  // a fake receipt in the ledger.
                  _timer?.cancel();
                  setState(() => _stage = _Stage.success);
                },
                child: const Text(
                  'dev: simulate PIN entry',
                  style: TextStyle(fontSize: 12),
                ),
              ),
            _textBtn('Cancel payment', () {
              _timer?.cancel();
              setState(() => _stage = _Stage.select);
            }),
          ],
        ),
      ),
    ],
  );

  Widget _pulseRing(double size, double opacity) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      shape: BoxShape.circle,
      border: Border.all(
        color: AppColors.blue600.withValues(alpha: opacity),
        width: 2,
      ),
    ),
  );

  // ───────────────────────── stage: success ─────────────────────────

  Widget _success() => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 26, 24, 8),
        child: Column(
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: 86,
                  height: 86,
                  decoration: const BoxDecoration(
                    color: AppColors.green50,
                    shape: BoxShape.circle,
                  ),
                ),
                Container(
                  width: 54,
                  height: 54,
                  decoration: const BoxDecoration(
                    color: AppColors.green500,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check_rounded,
                    size: 32,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Payment successful',
              style: GoogleFonts.poppins(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Installment ${widget.loan.nextInstallment!.number} · '
              'marked as Paid',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 15),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  _brow('Amount', Fmt.money(_amount, decimals: 2)),
                  _brow(
                    'Reference',
                    // The API mints this, so it matches the console ledger and
                    // what support will ask for. Never generated on-device.
                    _intent?.reference.isNotEmpty == true
                        ? _intent!.reference
                        : 'Pending',
                  ),
                  _brow('Method', '${_provider.label} ${_maskedPhone(_phone)}'),
                  _brow('Date', Fmt.date(DateTime.now())),
                  _brow('Loan', widget.loan.id, isLast: true),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _primaryBtn('Done', () => context.pop(), color: AppColors.blue600),
      const SizedBox(height: 18),
    ],
  );

  // ───────────────────────── stage: bank ─────────────────────────

  Widget _bankDetails() => Column(
    children: [
      _head('Bank transfer', 'Confirmed by your lender · 1–24 hrs'),
      _amountCard(label: 'Transfer exactly this amount'),
      Container(
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        padding: const EdgeInsets.symmetric(horizontal: 15),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.line),
        ),
        child: Column(
          children: [
            _brow('Bank', 'Your bank'),
            _brow('Account name', widget.loan.lenderName),
            _brow('Account no.', 'Provided by lender'),
            _brow('Branch', 'Cairo Road'),
            _brow(
              'Reference',
              'KX-${widget.loan.id.substring(widget.loan.id.length - 5)}',
              isLast: true,
            ),
          ],
        ),
      ),
      _hint(
        icon: Icons.account_balance_rounded,
        text: const Text.rich(
          TextSpan(
            style: TextStyle(fontSize: 12, height: 1.5),
            children: [
              TextSpan(text: 'Use the '),
              TextSpan(
                text: 'exact reference',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              TextSpan(
                text:
                    " — it's how your lender matches your payment to "
                    'this loan.',
              ),
            ],
          ),
        ),
      ),
      _primaryBtn(
        "I've sent the money",
        _bankConfirm,
        color: AppColors.blue600,
      ),
      _textBtn('← Back', () => setState(() => _stage = _Stage.select)),
      const SizedBox(height: 18),
    ],
  );

  Widget _bankSent() => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 30, 24, 10),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.blue50,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.schedule_rounded,
                size: 30,
                color: AppColors.blue600,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Transfer recorded',
              style: GoogleFonts.poppins(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Your lender will confirm the transfer within 24 hours. '
              "You'll get an alert as soon as it's applied to your loan.",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                color: AppColors.ink2,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _primaryBtn('Done', () => context.pop(), color: AppColors.blue600),
      const SizedBox(height: 18),
    ],
  );

  // ───────────────────────── stage: failed ─────────────────────────

  Widget _failed() => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(24, 30, 24, 10),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppColors.red50,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.error_outline_rounded,
                size: 30,
                color: AppColors.red,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              'Payment not completed',
              style: GoogleFonts.poppins(
                fontSize: 16.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _failureMsg ??
                  'No approval was received in time — no money has left '
                      'your wallet. You can try again.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.ink2,
                height: 1.6,
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      _primaryBtn('Try Again', () => setState(() => _stage = _Stage.select)),
      const SizedBox(height: 18),
    ],
  );
}

enum _HintTone { amber, blue }
