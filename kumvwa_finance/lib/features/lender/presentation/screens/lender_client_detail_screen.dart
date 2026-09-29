import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
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
        const SizedBox(height: 18),
        _Section(title: 'Profile', children: [
          _Field('Email', client['email'] as String? ?? 'Not provided'), _Field('NRC', client['nrc'] as String? ?? 'Not provided'), _Field('Date of birth', client['dob']?.toString() ?? 'Not provided'), _Field('Address', client['address'] as String? ?? 'Not provided'), _Field('Employment', client['employmentStatus'] as String? ?? 'Not provided'), _Field('Income band', client['incomeBand'] as String? ?? 'Not provided'), _Field('Income source', client['incomeSource'] as String? ?? 'Not provided'), _Field('Next of kin', client['kinName'] as String? ?? 'Not provided'), _Field('Kin phone', client['kinPhone'] as String? ?? 'Not provided'),
        ]),
        const SizedBox(height: 14), Text('Loans', style: AppText.cardTitle), const SizedBox(height: 8),
        ...((client['loans'] as List? ?? []).map((raw) { final loan = Map<String, dynamic>.from(raw as Map); return Card(child: ListTile(onTap: () => context.push('/lender/loans/${loan['id']}'), title: Text(loan['loanRef'] as String? ?? 'Loan'), subtitle: Text('${loan['status'] ?? ''} | Outstanding ${Fmt.money((loan['outstanding'] as num?) ?? 0)}'), trailing: const Icon(Icons.chevron_right_rounded))); })),
      ]),
    );
  }
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
