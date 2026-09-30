import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/app_refresh.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';

class LenderRequestsScreen extends ConsumerStatefulWidget {
  const LenderRequestsScreen({super.key});

  @override
  ConsumerState<LenderRequestsScreen> createState() =>
      _LenderRequestsScreenState();
}

class _LenderRequestsScreenState
    extends ConsumerState<LenderRequestsScreen> {
  List<Map<String, dynamic>> _items = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final response = await ref
          .read(apiClientProvider)
          .getA('/loan-requests/inbox?status=pending');
      final data = response.data as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _items = (data['items'] as List? ?? [])
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList();
        _loading = false;
      });
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _error = ApiException.fromDio(e).message;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = 'Could not load loan requests';
          _loading = false;
        });
      }
    }
  }

  Future<void> _open(Map<String, dynamic> request) async {
    try {
      final response = await ref
          .read(apiClientProvider)
          .getA('/loan-requests/${request['id']}');
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (_) => _RequestDetail(
          request: Map<String, dynamic>.from(response.data as Map),
        ),
      );
    } on DioException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(ApiException.fromDio(e).message)),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    final dome = DomeHeader(
      small: true,
      padding: const EdgeInsets.fromLTRB(18, 14, 18, 44),
      child: DomeTitle(
        title: 'Loan requests',
        subtitle: '${_items.length} awaiting review',
      ),
    );

    if (_loading) {
      return AppRefresh(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            dome,
            const Padding(
              padding: EdgeInsets.only(top: 80),
              child: Center(
                child: CircularProgressIndicator(
                  color: AppColors.blue600,
                  strokeWidth: 2,
                ),
              ),
            ),
          ],
        ),
      );
    }

    if (_error != null) {
      return AppRefresh(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            dome,
            Padding(
              padding: const EdgeInsets.all(32),
              child: _Retry(message: _error!, onRetry: _load),
            ),
          ],
        ),
      );
    }

    if (_items.isEmpty) {
      return AppRefresh(
        onRefresh: _load,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [dome, const _Empty()],
        ),
      );
    }

    return AppRefresh(
      onRefresh: _load,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.zero,
        itemCount: _items.length + 1,
        separatorBuilder: (_, index) =>
            index == 0 ? const SizedBox.shrink() : const SizedBox(height: 9),
        itemBuilder: (_, index) {
          if (index == 0) return dome;
          final item = _items[index - 1];
          return Padding(
            padding: EdgeInsets.fromLTRB(
              18,
              index == 1 ? 16 : 0,
              18,
              index == _items.length ? 96 : 0,
            ),
            child: _RequestRow(
              request: item,
              onTap: () => _open(item),
            ),
          );
        },
      ),
    );
  }
}

class _RequestRow extends StatelessWidget {
  const _RequestRow({required this.request, required this.onTap});

  final Map<String, dynamic> request;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final amount = (request['amount'] as num?) ?? 0;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line2),
            boxShadow: AppShadows.sh1,
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.blue50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.person_rounded,
                  color: AppColors.blue600,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request['clientName'] as String? ?? 'Borrower',
                      style: AppText.cardTitle,
                    ),
                    const SizedBox(height: 3),
                    Text(
                      request['phone'] as String? ?? '',
                      style: AppText.fine,
                    ),
                    const SizedBox(height: 7),
                    Text(
                      '${request['termCount'] ?? 0} months'
                      ' | ${request['purpose'] ?? 'Loan request'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.fine,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(Fmt.money(amount), style: AppText.rowAmount),
                  const SizedBox(height: 6),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 19,
                    color: AppColors.muted,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RequestDetail extends StatelessWidget {
  const _RequestDetail({required this.request});

  final Map<String, dynamic> request;

  @override
  Widget build(BuildContext context) {
    final profile = Map<String, dynamic>.from(
      request['clientProfile'] as Map? ?? const {},
    );
    return Container(
      height: MediaQuery.of(context).size.height * .82,
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      decoration: const BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.line2,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text('Request details', style: AppText.sheetTitle),
          const SizedBox(height: 18),
          Expanded(
            child: ListView(
              children: [
                _Detail(
                  label: 'Borrower',
                  value: request['clientName'] as String? ?? '-',
                ),
                _Detail(
                  label: 'Phone',
                  value: request['phone'] as String? ?? '-',
                ),
                _Detail(
                  label: 'Requested amount',
                  value: Fmt.money((request['amount'] as num?) ?? 0),
                ),
                _Detail(
                  label: 'Repayment term',
                  value: '${request['termCount'] ?? 0} months',
                ),
                _Detail(
                  label: 'Purpose',
                  value: request['purpose'] as String? ?? '-',
                ),
                const SizedBox(height: 12),
                Text('Borrower profile', style: AppText.cardTitle),
                const SizedBox(height: 7),
                _Detail(
                  label: 'Employment',
                  value: profile['employmentStatus'] as String? ??
                      'Not provided',
                ),
                _Detail(
                  label: 'Income band',
                  value: profile['incomeBand'] as String? ?? 'Not provided',
                ),
                _Detail(
                  label: 'Education',
                  value:
                      profile['educationLevel'] as String? ?? 'Not provided',
                ),
                _Detail(
                  label: 'Next of kin',
                  value:
                      profile['nextOfKinName'] as String? ?? 'Not provided',
                ),
                _Detail(
                  label: 'Kin phone',
                  value:
                      profile['nextOfKinPhone'] as String? ?? 'Not provided',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Expanded(child: Text(label, style: AppText.fine)),
          const SizedBox(width: 12),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: AppText.paragraph.copyWith(fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(28),
      child: Text(
        'No loan requests are waiting for review.',
        textAlign: TextAlign.center,
        style: AppText.paragraph.copyWith(color: AppColors.muted),
      ),
    );
  }
}

class _Retry extends StatelessWidget {
  const _Retry({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(message, style: AppText.paragraph),
        const SizedBox(height: 12),
        TextButton(onPressed: onRetry, child: const Text('Try again')),
      ],
    );
  }
}
