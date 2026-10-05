import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';

class LenderClientDetailScreen extends ConsumerStatefulWidget {
  const LenderClientDetailScreen({super.key, required this.clientId});
  final String clientId;

  @override
  ConsumerState<LenderClientDetailScreen> createState() => _LenderClientDetailScreenState();
}

class _LenderClientDetailScreenState extends ConsumerState<LenderClientDetailScreen> {
  Map<String, dynamic>? _client;
  String? _error;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    try {
      final result = await ref.read(apiClientProvider).getA('/clients/${widget.clientId}');
      if (mounted) setState(() => _client = Map<String, dynamic>.from(result.data as Map));
    } on DioException catch (e) {
      if (mounted) setState(() => _error = ApiException.fromDio(e).message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final client = _client;
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('Client details')),
      body: client == null ? Center(child: _error == null ? const CircularProgressIndicator(color: AppColors.blue600) : Text(_error!)) : ListView(padding: const EdgeInsets.all(18), children: [
        Text(client['name'] as String? ?? 'Client', style: AppText.pageTitle),
        const SizedBox(height: 4), Text(client['phone'] as String? ?? '', style: AppText.rowSub),
        const SizedBox(height: 14),
        _PerformanceCard(raw: client['performance']),
        const SizedBox(height: 14),
        _Section(title: 'Profile', children: [
          _Field('Email', client['email'] as String? ?? 'Not provided'), _Field('NRC', client['nrc'] as String? ?? 'Not provided'), _Field('Date of birth', client['dob']?.toString() ?? 'Not provided'), _Field('Address', client['address'] as String? ?? 'Not provided'), _Field('Employment', client['employmentStatus'] as String? ?? 'Not provided'), _Field('Income band', client['incomeBand'] as String? ?? 'Not provided'), _Field('Income source', client['incomeSource'] as String? ?? 'Not provided'), _Field('Next of kin', client['kinName'] as String? ?? 'Not provided'), _Field('Kin phone', client['kinPhone'] as String? ?? 'Not provided'), _Field('Second next of kin', client['kin2Name'] as String? ?? 'Not provided'), _Field('Second kin phone', client['kin2Phone'] as String? ?? 'Not provided'),
        ]),
        const SizedBox(height: 14), Text('Loans', style: AppText.cardTitle), const SizedBox(height: 8),
        ...((client['loans'] as List? ?? []).map((raw) { final loan = Map<String, dynamic>.from(raw as Map); return Card(child: ListTile(onTap: () => context.push('/lender/loans/${loan['id']}'), title: Text(loan['loanRef'] as String? ?? 'Loan'), subtitle: Text('${loan['status'] ?? ''} | Outstanding ${Fmt.money((loan['outstanding'] as num?) ?? 0)}'), trailing: const Icon(Icons.chevron_right_rounded))); })),
      ]),
    );
  }
}

/// "Would you lend to them again?" — the borrower's on-time payment
/// percentage for THIS lender's book only.
///
/// Before any installment has fallen due there is no judgement to make, so the
/// card says so rather than showing a misleading 0%.
class _PerformanceCard extends StatelessWidget {
  const _PerformanceCard({required this.raw});
  final Object? raw;

  @override
  Widget build(BuildContext context) {
    final p = raw is Map ? Map<String, dynamic>.from(raw as Map) : null;
    if (p == null) return const SizedBox.shrink();

    final hasHistory = p['hasHistory'] == true;
    final rate = ((p['onTimeRate'] as num?) ?? 0).toDouble();
    final onTime = (p['onTime'] as num?)?.toInt() ?? 0;
    final late = (p['late'] as num?)?.toInt() ?? 0;
    final overdueNow = (p['overdueNow'] as num?)?.toInt() ?? 0;

    final tone = !hasHistory
        ? AppColors.muted
        : rate >= 80
        ? AppColors.green700
        : rate >= 50
        ? AppColors.amber
        : AppColors.red;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(AppRadii.card),
        boxShadow: AppShadows.sh1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Repayment behaviour', style: AppText.cardTitle),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasHistory ? '${_trim(rate)}%' : '—',
                      style: AppText.statValue.copyWith(
                        color: tone,
                        fontSize: 30,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasHistory ? 'paid on time' : 'No instalments due yet',
                      style: AppText.fine,
                    ),
                  ],
                ),
              ),
              // Only rendered once something has actually been judged.
              if (hasHistory)
                Column(
                  children: [
                    _Count(label: 'On time', value: onTime, color: AppColors.green700),
                    const SizedBox(height: 6),
                    _Count(label: 'Late', value: late, color: AppColors.amber),
                    const SizedBox(height: 6),
                    _Count(label: 'Overdue', value: overdueNow, color: AppColors.red),
                  ],
                ),
            ],
          ),
          if (hasHistory) ...[
            const SizedBox(height: 12),
            // Proportion bar — reads the same numbers as the counts above.
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadii.pill),
              child: LinearProgressIndicator(
                value: rate / 100,
                minHeight: 6,
                backgroundColor: AppColors.blue50,
                valueColor: AlwaysStoppedAnimation<Color>(tone),
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Lenders use this to decide whether to recommend this borrower.',
              style: AppText.fine,
            ),
          ],
        ],
      ),
    );
  }

  static String _trim(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(1);
}

class _Count extends StatelessWidget {
  const _Count({required this.label, required this.value, required this.color});
  final String label; final int value; final Color color;
  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8, height: 8,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text('$value $label', style: AppText.fine),
        ],
      );
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});
  final String title; final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.line), borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: AppText.cardTitle), const SizedBox(height: 8), ...children]));
}

class _Field extends StatelessWidget {
  const _Field(this.label, this.value); final String label; final String value;
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(vertical: 5), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [Expanded(child: Text(label, style: AppText.fine)), Expanded(child: Text(value, textAlign: TextAlign.right, style: AppText.paragraph))]));
}
