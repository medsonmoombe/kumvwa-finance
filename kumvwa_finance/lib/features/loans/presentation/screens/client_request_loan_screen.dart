import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_filter_chip.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';

class ClientRequestLoanScreen extends ConsumerStatefulWidget {
  const ClientRequestLoanScreen({super.key});

  @override
  ConsumerState<ClientRequestLoanScreen> createState() =>
      _ClientRequestLoanScreenState();
}

class _ClientRequestLoanScreenState
    extends ConsumerState<ClientRequestLoanScreen> {
  final _amountCtrl = TextEditingController();
  final _purposeCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  String? _lenderId;
  String? _lenderName;
  int _term = 3;
  var _submitting = false;

  @override
  void dispose() {
    _amountCtrl.dispose();
    _purposeCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_lenderId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Choose a lender first')),
      );
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final session = ref.read(authControllerProvider).session!;
    setState(() => _submitting = true);
    try {
      await ref.read(loanRequestsRepositoryProvider).create(
            clientId: session.userId,
            clientName: session.displayName,
            lenderId: _lenderId!,
            lenderName: _lenderName!,
            amount: double.parse(_amountCtrl.text.trim()),
            termInstallments: _term,
            purpose: _purposeCtrl.text,
          );
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
      return;
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Request sent — the lender will review it'),
      ),
    );
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final lendersAsync = session == null
        ? const AsyncValue<List<({String id, String name})>>.data([])
        : ref.watch(linkedLendersProvider(session.userId));
    final limit = session == null
        ? 0.0
        : ref.watch(creditLimitProvider(session.userId)).valueOrNull ?? 0;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
        title: const Text('Request a Loan'),
      ),
      body: SafeArea(
        child: lendersAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                Skeleton(width: double.infinity, height: 40, radius: 99),
                SizedBox(height: 16),
                Skeleton(width: double.infinity, height: 54, radius: 14),
                SizedBox(height: 16),
                Skeleton(width: double.infinity, height: 120, radius: 14),
              ],
            ),
          ),
          error: (_, _) => const Center(child: Text('Could not load lenders')),
          data: (lenders) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 20),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Lender',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (lenders.isEmpty)
                    const Text(
                      'You have no linked lenders yet.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.muted),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final l in lenders)
                          AppFilterChip(
                            label: l.name,
                            selected: _lenderId == l.id,
                            onTap: () => setState(() {
                              _lenderId = l.id;
                              _lenderName = l.name;
                            }),
                          ),
                      ],
                    ),
                  const SizedBox(height: 20),
                  AppTextField(
                    label: 'Amount (ZMW)',
                    controller: _amountCtrl,
                    hint: 'e.g. 4000',
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.next,
                    enabled: !_submitting,
                    onChanged: (_) => setState(() {}), // refresh estimate
                    validator: (v) {
                      final amount = double.tryParse(v?.trim() ?? '');
                      if (amount == null) return 'Enter a valid amount';
                      if (amount < 100) return 'Minimum request is K 100';
                      if (limit > 0 && amount > limit) {
                        return 'Above your limit of ${Fmt.money(limit)}';
                      }
                      return null;
                    },
                  ),
                  if (limit > 0) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.shield_outlined,
                            size: 15, color: AppColors.blue600),
                        const SizedBox(width: 7),
                        Expanded(
                          child: Text(
                            'Your limit: ${Fmt.money(limit)} · based on your '
                            'risk profile and repayment history',
                            style: const TextStyle(
                              fontSize: 11.5,
                              color: AppColors.blue600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 20),
                  // ---------- duration slider ----------
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Repayment duration',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: AppColors.ink,
                        ),
                      ),
                      Text(
                        '$_term month${_term == 1 ? '' : 's'}',
                        style: GoogleFonts.poppins(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.blue600,
                        ),
                      ),
                    ],
                  ),
                  Slider(
                    value: _term.toDouble(),
                    min: 1,
                    max: 12,
                    divisions: 11,
                    label: '$_term mo',
                    activeColor: AppColors.blue600,
                    onChanged: _submitting
                        ? null
                        : (v) => setState(() => _term = v.round()),
                  ),
                  Builder(
                    builder: (_) {
                      final amount = double.tryParse(_amountCtrl.text.trim());
                      final estimate = amount == null ? null : amount / _term;
                      return Text(
                        estimate == null
                            ? 'Enter an amount to see your estimated '
                                'monthly installment'
                            : '≈ ${Fmt.money(estimate, decimals: 2)} per '
                                'month, before the lender\'s interest',
                        style: const TextStyle(
                          fontSize: 11.5,
                          color: AppColors.muted,
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                  AppTextField(
                    label: 'What is the loan for?',
                    controller: _purposeCtrl,
                    hint: 'e.g. Restock shop inventory',
                    maxLines: 3,
                    enabled: !_submitting,
                    validator: (v) => Validators.required(
                      v,
                      field: 'Loan purpose',
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: (_submitting || lenders.isEmpty) ? null : _submit,
                    child: _submitting
                        ? const ButtonSpinner()
                        : const Text('Submit'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
