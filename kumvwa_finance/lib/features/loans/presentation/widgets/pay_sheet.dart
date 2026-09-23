import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

enum _PayMethod { airtel, momo, bank }

/// Bottom sheet: settle the next installment (works as paying in advance).
/// Payment is SIMULATED until the backend/mobile-money integration.
Future<void> showPaySheet(
  BuildContext context,
  WidgetRef ref,
  Loan loan,
) async {
  final next = loan.nextInstallment;
  if (next == null) return;

  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetCtx) => _PaySheet(
      loan: loan,
      amount: next.amount,
      ref: ref,
    ),
  );

  // Refresh every provider that shows loan state.
  ref.invalidate(clientLoansProvider);
  ref.invalidate(loansProvider);
  ref.invalidate(loanByIdProvider(loan.id));
}

class _PaySheet extends StatefulWidget {
  const _PaySheet({required this.loan, required this.amount, required this.ref});

  final Loan loan;
  final double amount;
  final WidgetRef ref;

  @override
  State<_PaySheet> createState() => _PaySheetState();
}

class _PaySheetState extends State<_PaySheet> {
  var _method = _PayMethod.airtel;
  var _processing = false;

  Future<void> _confirm() async {
    setState(() => _processing = true);
    try {
      // Via the repository provider so mock AND API modes share the same
      // call site (API: POST /loans/:id/repayments). The pay sheet knows the
      // exact amount — the next installment — and passes it through.
      await widget.ref.read(loansRepositoryProvider).recordPayment(
        widget.loan.id,
        amount: widget.amount,
      );
    } catch (e) {
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst(RegExp(r'^.*Exception: '), ''),
          ),
        ),
      );
      return;
    }
    if (!mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Payment of ${Fmt.money(widget.amount, decimals: 2)} to '
          '${widget.loan.lenderName} recorded ✅',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Pay installment',
              style: GoogleFonts.poppins(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '${widget.loan.lenderName} · ${widget.loan.id}',
              style: const TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.blue50,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Amount',
                      style: TextStyle(
                          fontSize: 12.5, color: AppColors.ink2)),
                  Text(
                    Fmt.money(widget.amount, decimals: 2),
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: AppColors.blue600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            const Text(
              'Pay with',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.ink2,
              ),
            ),
            const SizedBox(height: 8),
            _methodTile(_PayMethod.airtel, 'Airtel Money', '••• 2233'),
            _methodTile(_PayMethod.momo, 'MTN MoMo', '••• 2233'),
            _methodTile(_PayMethod.bank, 'Bank transfer', 'ZANACO ••4021'),
            const SizedBox(height: 16),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.green500,
                minimumSize: const Size.fromHeight(52),
              ),
              onPressed: _processing ? null : _confirm,
              child: _processing
                  ? const ButtonSpinner()
                  : const Text('Confirm & Pay'),
            ),
            const SizedBox(height: 8),
            const Text(
              'Repayments are recorded against this loan. '
              'Mobile-money collection is handled by your lender.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10.5, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _methodTile(_PayMethod m, String label, String detail) {
    return GestureDetector(
      onTap: () => setState(() => _method = m),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 11),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _method == m ? AppColors.blue600 : AppColors.line,
            width: _method == m ? 1.5 : 1,
          ),
          color: _method == m ? AppColors.blue50 : Colors.white,
        ),
        child: Row(
          children: [
            Icon(
              m == _PayMethod.bank
                  ? Icons.account_balance_outlined
                  : Icons.smartphone_outlined,
              size: 19,
              color: _method == m ? AppColors.blue600 : AppColors.muted,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                '$label  ·  $detail',
                style: const TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.ink,
                ),
              ),
            ),
            if (_method == m)
              const Icon(Icons.check_circle,
                  size: 18, color: AppColors.blue600),
          ],
        ),
      ),
    );
  }
}
