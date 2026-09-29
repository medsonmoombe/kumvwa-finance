import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';

class LenderLoanDetailScreen extends ConsumerStatefulWidget {
  const LenderLoanDetailScreen({super.key, required this.loanId});
  final String loanId;
  @override
  ConsumerState<LenderLoanDetailScreen> createState() => _LenderLoanDetailScreenState();
}

class _LenderLoanDetailScreenState extends ConsumerState<LenderLoanDetailScreen> {
  Map<String, dynamic>? _loan; String? _error;
  @override
  void initState() { super.initState(); _load(); }
  Future<void> _load() async { try { final response = await ref.read(apiClientProvider).getA('/loans/${widget.loanId}'); if (mounted) setState(() => _loan = Map<String, dynamic>.from(response.data as Map)); } on DioException catch (e) { if (mounted) setState(() => _error = ApiException.fromDio(e).message); } }
  @override
  Widget build(BuildContext context) { final loan = _loan; return Scaffold(backgroundColor: AppColors.bg, appBar: AppBar(title: const Text('Loan details')), body: loan == null ? Center(child: _error == null ? const CircularProgressIndicator(color: AppColors.blue600) : Text(_error!)) : ListView(padding: const EdgeInsets.all(18), children: [Text(loan['loanRef'] as String? ?? 'Loan', style: AppText.pageTitle), const SizedBox(height: 4), Text(loan['clientName'] as String? ?? '', style: AppText.rowSub), const SizedBox(height: 18), _Amount(label: 'Outstanding', value: Fmt.money((loan['outstanding'] as num?) ?? 0)), const SizedBox(height: 12), _Info(label: 'Status', value: loan['status'] as String? ?? ''), _Info(label: 'Principal', value: Fmt.money((loan['principal'] as num?) ?? 0)), _Info(label: 'Total due', value: Fmt.money((loan['totalDue'] as num?) ?? 0)), _Info(label: 'Paid', value: Fmt.money((loan['paidAmount'] as num?) ?? 0)), _Info(label: 'Term', value: '${loan['termCount'] ?? 0} months'), _Info(label: 'Frequency', value: loan['frequency'] as String? ?? '-'), const SizedBox(height: 16), Text('Repayment schedule', style: AppText.cardTitle), const SizedBox(height: 8), ...((loan['schedule'] as List? ?? []).map((raw) { final item = Map<String, dynamic>.from(raw as Map); return Card(child: ListTile(title: Text('Installment ${item['seq']}'), subtitle: Text(item['dueDate']?.toString() ?? ''), trailing: Text(Fmt.money((item['amount'] as num?) ?? 0), style: AppText.rowAmount))); })), ])); }
}

class _Amount extends StatelessWidget { const _Amount({required this.label, required this.value}); final String label; final String value; @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: AppColors.blue50, borderRadius: BorderRadius.circular(12)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: AppText.fine), const SizedBox(height: 4), Text(value, style: AppText.amountLarge)])); }
class _Info extends StatelessWidget { const _Info({required this.label, required this.value}); final String label; final String value; @override Widget build(BuildContext context) => Container(margin: const EdgeInsets.only(bottom: 7), padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: AppColors.card, border: Border.all(color: AppColors.line), borderRadius: BorderRadius.circular(10)), child: Row(children: [Expanded(child: Text(label, style: AppText.fine)), Text(value, style: AppText.paragraph)])); }
