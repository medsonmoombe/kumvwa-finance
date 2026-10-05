import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/client_dome_header.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/core/widgets/provider_logo.dart';
import 'package:kumvwa_finance/features/payments/data/payments_repository.dart';
import 'package:kumvwa_finance/features/payments/domain/payment_intent.dart';

/// Every payment the borrower has made, with the reference they would quote to
/// support.
///
/// This exists because a mobile-money payment is invisible: the money leaves the
/// borrower's wallet, the loan balance changes, and there is no paper. Without a
/// receipt the borrower's only recourse when a balance looks wrong is "it was
/// deducted and nobody knows where it went", which is exactly the situation a
/// lender gets a fraud report about.
class PaymentReceiptsScreen extends ConsumerWidget {
  const PaymentReceiptsScreen({super.key, this.loanId, this.loanRef});

  /// When set, only that loan's payments are shown (reached from loan detail).
  final String? loanId;
  final String? loanRef;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(paymentReceiptsProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.blue600,
          onRefresh: () async => ref.invalidate(paymentReceiptsProvider),
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: EdgeInsets.zero,
            children: [
              ClientDomeHeader(
                title: 'Payment receipts',
                subtitle: loanRef != null
                    ? 'Payments on $loanRef'
                    : 'Your payment history',
                onBack: () => Navigator.of(context).maybePop(),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                child: async.when(
                  loading: () => Column(
                    children: List.generate(
                      5,
                      (_) => const Padding(
                        padding: EdgeInsets.only(bottom: 10),
                        child: Skeleton(
                          width: double.infinity,
                          height: 74,
                          radius: 15,
                        ),
                      ),
                    ),
                  ),
                  error: (e, _) => _ErrorCard(
                    label: 'Could not load your receipts',
                    detail: describeApiError(e),
                    onRetry: () => ref.invalidate(paymentReceiptsProvider),
                  ),
                  data: (all) {
                    final items = loanId == null
                        ? all
                        : all.where((p) => p.loanId == loanId).toList();
                    if (items.isEmpty) {
                      return _EmptyCard(
                        message: loanId == null
                            ? 'No payments yet. When you pay an installment, '
                                  'the receipt appears here.'
                            : 'No payments recorded on this loan yet.',
                      );
                    }
                    return Column(
                      children: [
                        _Summary(count: items.length, items: items),
                        const SizedBox(height: 12),
                        for (final p in items) ...[
                          _ReceiptTile(payment: p),
                          const SizedBox(height: 9),
                        ],
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Totals are labelled by what they actually mean. "Paid" sums only settled
/// charges: an amount that is still pending has not left the borrower's wallet,
/// and counting it would overstate what they have paid.
class _Summary extends StatelessWidget {
  const _Summary({required this.count, required this.items});

  final int count;
  final List<PaymentIntent> items;

  @override
  Widget build(BuildContext context) {
    final paid = items
        .where((p) => p.status.isPaid)
        .fold<double>(0, (sum, p) => sum + p.amountKwacha);
    final pending = items
        .where((p) => p.status.isPending)
        .fold<double>(0, (sum, p) => sum + p.amountKwacha);

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: _Stat(
              label: 'Total paid',
              value: Fmt.money(paid, decimals: 2),
              color: AppColors.green700,
            ),
          ),
          Container(width: 1, height: 34, color: AppColors.line),
          Expanded(
            child: _Stat(
              label: 'Pending',
              value: Fmt.money(pending, decimals: 2),
              color: pending > 0 ? AppColors.blue600 : AppColors.muted,
            ),
          ),
          Container(width: 1, height: 34, color: AppColors.line),
          Expanded(
            child: _Stat(
              label: 'Payments',
              value: '$count',
              color: AppColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Text(
        value,
        style: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
    ],
  );
}

class _ReceiptTile extends StatelessWidget {
  const _ReceiptTile({required this.payment});

  final PaymentIntent payment;

  @override
  Widget build(BuildContext context) {
    final failed = payment.status.isDead;
    final pending = payment.status.isPending;
    final reason = payment.failureReason;

    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(
          color: failed
              ? const Color(0xFFF3D3D3)
              : pending
              ? const Color(0xFFC9D6F0)
              : AppColors.line,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              ProviderLogo(provider: payment.provider, size: 26),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      Fmt.money(payment.amountKwacha, decimals: 2),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.ink,
                      ),
                    ),
                    Text(
                      payment.createdAt == null
                          ? payment.provider.label
                          : '${Fmt.date(payment.createdAt!)} · '
                                '${payment.provider.label}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.muted,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusPill(status: payment.status),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Text(
                'Reference',
                style: TextStyle(fontSize: 11, color: AppColors.muted),
              ),
              const Spacer(),
              SelectableText(
                payment.reference,
                style: const TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: .4,
                  color: AppColors.blue600,
                ),
              ),
            ],
          ),
          // A failed charge needs its reason shown, otherwise "Failed" with no
          // explanation is the least useful receipt in the app.
          if (reason != null && reason.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              reason,
              style: const TextStyle(
                fontSize: 11,
                height: 1.4,
                color: AppColors.red,
              ),
            ),
          ],
          if (pending) ...[
            const SizedBox(height: 6),
            const Text(
              'This payment has not completed. It only counts as paid once '
              'your provider confirms it.',
              style: TextStyle(
                fontSize: 11,
                height: 1.4,
                color: AppColors.muted,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final PaymentStatus status;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = switch (status) {
      PaymentStatus.succeeded => (AppColors.green50, AppColors.green700),
      PaymentStatus.failed ||
      PaymentStatus.cancelled ||
      PaymentStatus.expired => (AppColors.red50, AppColors.red),
      PaymentStatus.refunded || PaymentStatus.partiallyRefunded => (
        AppColors.amber50,
        const Color(0xFF7A5200),
      ),
      _ => (AppColors.blue50, AppColors.blue600),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 10.5,
          fontWeight: FontWeight.w800,
          color: fg,
        ),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.label, required this.onRetry, this.detail});

  final String label;
  final String? detail;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.red50,
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.red)),
        if (detail != null) ...[
          const SizedBox(height: 4),
          Text(
            detail!,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
        ],
        const SizedBox(height: 8),
        TextButton(onPressed: onRetry, child: const Text('Retry')),
      ],
    ),
  );
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(vertical: 34, horizontal: 18),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(AppRadii.card),
      border: Border.all(color: AppColors.line),
    ),
    child: Column(
      children: [
        const Icon(
          Icons.receipt_long_outlined,
          size: 30,
          color: AppColors.muted,
        ),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 12,
            height: 1.5,
            color: AppColors.muted,
          ),
        ),
      ],
    ),
  );
}
