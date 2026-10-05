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
import 'package:kumvwa_finance/core/widgets/app_refresh.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';

class LenderClientsScreen extends ConsumerStatefulWidget {
  const LenderClientsScreen({super.key});

  @override
  ConsumerState<LenderClientsScreen> createState() =>
      _LenderClientsScreenState();
}

class _LenderClientsScreenState extends ConsumerState<LenderClientsScreen> {
  List<Map<String, dynamic>> _clients = [];
  bool _loading = true;
  String? _error;
  String _query = '';

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
      final client = ref.read(apiClientProvider);
      final res = await client.getA('/clients');
      final items = ((res.data as Map<String, dynamic>)['items'] as List? ?? [])
          .cast<Map<String, dynamic>>();
      setState(() {
        _clients = items;
        _loading = false;
      });
    } on DioException catch (e) {
      setState(() {
        _error = ApiException.fromDio(e).message;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_query.isEmpty) return _clients;
    final q = _query.toLowerCase();
    return _clients
        .where(
          (c) =>
              (c['name'] as String? ?? '').toLowerCase().contains(q) ||
              (c['phone'] as String? ?? '').contains(q),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: double.infinity,
              child: DomeHeader(
                small: true,
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 44),
                child: DomeTitle(
                  title: 'Clients',
                  subtitle: '${_clients.length} borrowers',
                  // Add-client lives in the dome rather than a FAB so it is
                  // reachable without scrolling a long list, and so the
                  // affordance sits where every other "create" action in the
                  // app already sits.
                  trailing: Semantics(
                    button: true,
                    label: 'Add client',
                    child: InkWell(
                      onTap: () => context.push('/lender/clients/new'),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        width: 36,
                        height: 36,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.28),
                          ),
                        ),
                        child: const Icon(
                          Icons.person_add_alt_1_rounded,
                          color: Colors.white,
                          size: 19,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
              child: _SearchBar(onChanged: (v) => setState(() => _query = v)),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: AppRefresh(
                onRefresh: _load,
                child: _loading
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 160),
                          Center(
                            child: CircularProgressIndicator(
                              color: AppColors.blue600,
                              strokeWidth: 2,
                            ),
                          ),
                        ],
                      )
                    : _error != null
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(height: 40),
                          _ErrorBody(message: _error!, onRetry: _load),
                        ],
                      )
                    : _filtered.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(height: 160),
                          _Empty(hasQuery: _query.isNotEmpty),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(18, 0, 18, 96),
                        itemCount: _filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (_, i) => _ClientRow(
                          client: _filtered[i],
                          onTap: () => context.push(
                            '/lender/clients/${_filtered[i]['id']}',
                          ),
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadii.input),
        border: Border.all(color: AppColors.line2, width: 1.5),
        boxShadow: AppShadows.sh1,
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          const Icon(Icons.search_rounded, size: 17, color: AppColors.muted),
          const SizedBox(width: 9),
          Expanded(
            child: TextField(
              onChanged: onChanged,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.ink,
              ),
              decoration: const InputDecoration(
                isDense: true,
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                filled: true,
                fillColor: Colors.transparent,
                hintText: 'Search by name or phone',
                hintStyle: TextStyle(
                  fontSize: 13,
                  color: AppColors.muted,
                  fontWeight: FontWeight.w500,
                ),
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
          const SizedBox(width: 14),
        ],
      ),
    );
  }
}

class _ClientRow extends StatelessWidget {
  const _ClientRow({required this.client, required this.onTap});

  final Map<String, dynamic> client;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final name = client['name'] as String? ?? 'Unknown';
    final status = client['status'] as String? ?? '';
    final outstanding = client['outstandingMinor'] as String?;

    final statusColor = status == 'overdue'
        ? AppColors.red
        : status == 'active'
        ? AppColors.green700
        : AppColors.muted;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.line),
            boxShadow: AppShadows.sh1,
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: AppColors.blue50,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  Fmt.initials(name),
                  style: AppText.cardTitle.copyWith(
                    color: AppColors.blue600,
                    fontSize: 12,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(name, style: AppText.rowTitle),
                    const SizedBox(height: 2),
                    Text(
                      client['phone'] as String? ?? '',
                      style: AppText.rowSub,
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  if (outstanding != null)
                    Text(
                      Fmt.money((int.tryParse(outstanding) ?? 0) / 100),
                      style: AppText.rowAmount,
                    ),
                  if (status.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(top: 3),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(
                        status,
                        style: AppText.chipLabel.copyWith(color: statusColor),
                      ),
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

class _Empty extends StatelessWidget {
  const _Empty({required this.hasQuery});

  final bool hasQuery;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.people_outline_rounded,
            size: 40,
            color: AppColors.muted,
          ),
          const SizedBox(height: 10),
          Text(
            hasQuery ? 'No clients match your search' : 'No clients yet',
            style: AppText.rowTitle.copyWith(color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              size: 40,
              color: AppColors.muted,
            ),
            const SizedBox(height: 10),
            Text(message, style: AppText.fine, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: onRetry,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.blue600,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.button),
                ),
              ),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
