import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/app_filter_chip.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/loan_request_card.dart';

class LoanRequestsScreen extends ConsumerWidget {
  const LoanRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;
    final async = session == null
        ? const AsyncValue<List<LoanRequest>>.data([])
        : ref.watch(loanRequestsByLenderProvider(session.userId));

    return Scaffold(
      appBar: AppBar(title: const Text('Loan Requests')),
      body: SafeArea(
        child: async.when(
          loading: () => ListView(
            padding: const EdgeInsets.all(16),
            children: const [
              SkeletonCard(showBadge: true),
              SizedBox(height: 9),
              SkeletonCard(showBadge: true),
              SizedBox(height: 9),
              SkeletonCard(showBadge: true),
            ],
          ),
          error: (_, _) =>
              const Center(child: Text('Could not load requests')),
          data: (requests) => _List(requests: requests),
        ),
      ),
    );
  }
}

class _List extends StatefulWidget {
  const _List({required this.requests});

  final List<LoanRequest> requests;

  @override
  State<_List> createState() => _ListState();
}

class _ListState extends State<_List> {
  var _pendingOnly = false;

  @override
  Widget build(BuildContext context) {
    final pending = widget.requests
        .where((r) => r.status == LoanRequestStatus.pending)
        .length;
    final filtered = _pendingOnly
        ? widget.requests
            .where((r) => r.status == LoanRequestStatus.pending)
            .toList()
        : widget.requests;

    // No pull-to-refresh here: the inbox reloads whenever the providers are
    // invalidated after an approve/reject elsewhere.
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
          child: Row(
            children: [
              AppFilterChip(
                label: 'Pending ($pending)',
                selected: _pendingOnly,
                onTap: () => setState(() => _pendingOnly = true),
              ),
              const SizedBox(width: 8),
              AppFilterChip(
                label: 'All (${widget.requests.length})',
                selected: !_pendingOnly,
                onTap: () => setState(() => _pendingOnly = false),
              ),
            ],
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: [
                    const SizedBox(height: 90),
                    const Icon(Icons.inbox_outlined,
                        size: 44, color: AppColors.muted),
                    const SizedBox(height: 14),
                    const Center(
                      child: Text(
                        'No loan requests here yet',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Center(
                      child: Text(
                        'Requests from your clients will appear here',
                        style: TextStyle(
                            fontSize: 12.5, color: AppColors.muted),
                      ),
                    ),
                  ],
                )
              : ListView.builder(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(16, 2, 16, 24),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: LoanRequestCard(
                      request: filtered[i],
                      titleName: filtered[i].clientName,
                      onTap: () =>
                          context.push('/requests/${filtered[i].id}'),
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}
