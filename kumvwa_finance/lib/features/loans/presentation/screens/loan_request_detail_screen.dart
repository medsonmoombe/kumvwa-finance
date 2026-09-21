import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';

class LoanRequestDetailScreen extends ConsumerStatefulWidget {
  const LoanRequestDetailScreen({super.key, required this.requestId});

  final String requestId;

  @override
  ConsumerState<LoanRequestDetailScreen> createState() =>
      _LoanRequestDetailScreenState();
}

class _LoanRequestDetailScreenState
    extends ConsumerState<LoanRequestDetailScreen> {
  var _busy = false;

  Future<void> _act(LoanRequest r) async {
    if (r.status == LoanRequestStatus.pending) {
      final action = await _chooseAction(r);
      if (action == null || !mounted) return;

      setState(() => _busy = true);
      try {
        if (action == _Action.approve) {
          final rate = await _pickRate();
          if (rate == null) return;
          final loan = await ref
              .read(loanRequestsRepositoryProvider)
              .approve(r.id, interestRatePct: rate);
          _invalidate(r);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Approved — loan ${loan.id} created for ${r.clientName}',
              ),
            ),
          );
        } else {
          final feedback = await _pickFeedback();
          if (feedback == null) return;
          await ref
              .read(loanRequestsRepositoryProvider)
              .reject(r.id, feedback: feedback);
          _invalidate(r);
          if (!mounted) return;
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Request declined — ${r.clientName} will see your feedback',
              ),
            ),
          );
        }
        if (mounted) context.pop();
      } finally {
        if (mounted) setState(() => _busy = false);
      }
    }
  }

  void _invalidate(LoanRequest r) {
    ref.invalidate(loanRequestByIdProvider(r.id));
    ref.invalidate(loanRequestsByLenderProvider(r.lenderId));
    ref.invalidate(loanRequestsByClientProvider(r.clientId));
    ref.invalidate(loansProvider);
    ref.invalidate(clientLoansProvider);
  }

  Future<_Action?> _chooseAction(LoanRequest r) {
    return showDialog<_Action>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Review request'),
        content: Text(
          '${Fmt.money(r.amount)} over ${r.termInstallments} months '
          'for ${r.clientName}.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _Action.reject),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Decline'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, _Action.approve),
            style: TextButton.styleFrom(
              foregroundColor: AppColors.green700,
              textStyle: const TextStyle(fontWeight: FontWeight.w700),
            ),
            child: const Text('Approve'),
          ),
        ],
      ),
    );
  }

  Future<double?> _pickRate() {
    var rate = 15.0;
    return showDialog<double>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialog) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
          title: const Text('Interest rate'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '${rate.toStringAsFixed(0)}% flat',
                style: GoogleFonts.poppins(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.blue600,
                ),
              ),
              Slider(
                value: rate,
                min: 10,
                max: 30,
                divisions: 4,
                label: '${rate.toStringAsFixed(0)}%',
                onChanged: (v) => setDialog(() => rate = v),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, rate),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.green700,
                textStyle: const TextStyle(fontWeight: FontWeight.w700),
              ),
              child: const Text('Create Loan'),
            ),
          ],
        ),
      ),
    );
  }

  Future<String?> _pickFeedback() {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Decline — feedback'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          maxLength: 200,
          decoration: const InputDecoration(
            hintText:
                'Tell the client why (e.g. amount above your policy limit…)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              if (ctrl.text.trim().length >= 10) {
                Navigator.pop(ctx, ctrl.text);
              }
            },
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Decline Request'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(loanRequestByIdProvider(widget.requestId));

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Loan Request'),
            Text(
              widget.requestId,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w400,
                color: AppColors.muted,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                Skeleton(width: double.infinity, height: 130, radius: 16),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 160, radius: 16),
              ],
            ),
          ),
          error: (_, _) => const Center(child: Text('Request not found')),
          data: (r) => Column(
            children: [
              Expanded(child: _Content(request: r)),
              if (r.status == LoanRequestStatus.pending)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _busy ? null : () => _act(r),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.red,
                            side: const BorderSide(color: AppColors.red),
                            minimumSize: const Size.fromHeight(52),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          child: const Text('Decline'),
                        ),
                      ),
                      const SizedBox(width: 9),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _busy ? null : () => _act(r),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.green500,
                            minimumSize: const Size.fromHeight(52),
                          ),
                          child: _busy
                              ? const ButtonSpinner()
                              : const Text('Approve'),
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

enum _Action { approve, reject }

class _Content extends ConsumerWidget {
  const _Content({required this.request});

  final LoanRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final allLoans = ref.watch(loansProvider).valueOrNull ?? const <Loan>[];
    final clientLoans =
        allLoans.where((l) => l.clientId == request.clientId).toList();

    final active =
        clientLoans.where((l) => l.status == LoanStatus.active).length;
    final overdue =
        clientLoans.where((l) => l.status == LoanStatus.overdue).length;
    final cleared =
        clientLoans.where((l) => l.status == LoanStatus.cleared).length;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      children: [
        // ---------- request summary ----------
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    Fmt.money(request.amount),
                    style: GoogleFonts.poppins(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                    ),
                  ),
                  switch (request.status) {
                    LoanRequestStatus.pending =>
                      const AppBadge('Pending', variant: BadgeVariant.amber),
                    LoanRequestStatus.approved =>
                      const AppBadge('Approved', variant: BadgeVariant.green),
                    LoanRequestStatus.rejected =>
                      const AppBadge('Declined', variant: BadgeVariant.red),
                  },
                ],
              ),
              const SizedBox(height: 4),
              Text(
                '${request.termInstallments} monthly installments · '
                'requested ${Fmt.date(request.requestedAt)}',
                style: const TextStyle(
                    fontSize: 11.5, color: AppColors.muted),
              ),
              const SizedBox(height: 12),
              const Text(
                'Purpose',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.muted,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                request.purpose,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.ink,
                  height: 1.5,
                ),
              ),
              if (request.feedback != null) ...[
                const SizedBox(height: 12),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.red50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Feedback sent: ${request.feedback}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: Color(0xFFC03538),
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 11),
        // ---------- applicant ----------
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Applicant',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 10),
              _row('Name', request.clientName),
              _row('NRC', request.nrc),
              _row('Phone', request.phone),
            ],
          ),
        ),
        const SizedBox(height: 11),
        // ---------- platform exposure ----------
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Repayment history on Kumvwa',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 3),
              const Text(
                'Internal platform data · bureau scoring runs server-side',
                style: TextStyle(fontSize: 10, color: AppColors.muted),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _stat('$active', 'Active',
                        active > 0 ? AppColors.green700 : AppColors.muted),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _stat('$overdue', 'Overdue',
                        overdue > 0 ? AppColors.red : AppColors.muted),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _stat('$cleared', 'Cleared',
                        cleared > 0 ? AppColors.blue600 : AppColors.muted),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 70,
            child: Text(label,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.muted)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String value, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: GoogleFonts.poppins(
              fontSize: 17,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          Text(label,
              style:
                  const TextStyle(fontSize: 10, color: AppColors.muted)),
        ],
      ),
    );
  }
}
