import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/app_filter_chip.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/clients/presentation/clients_controller.dart';
import 'package:kumvwa_finance/features/clients/presentation/widgets/client_card.dart';

class ClientsScreen extends ConsumerStatefulWidget {
  const ClientsScreen({super.key});

  @override
  ConsumerState<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends ConsumerState<ClientsScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(clientsControllerProvider);
    final controller = ref.read(clientsControllerProvider.notifier);
    final results = state.filtered;

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Clients'),
            const SizedBox(width: 8),
            AppBadge('${state.clients?.length ?? 0} total'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/clients/add'),
        backgroundColor: AppColors.blue600,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // ---------- search ----------
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
              child: TextField(
                controller: _searchCtrl,
                onChanged: controller.setQuery,
                style: AppText.body,
                decoration: const InputDecoration(
                  hintText: 'Search by name, NRC or phone…',
                  prefixIcon: Icon(
                    Icons.search,
                    size: 19,
                    color: AppColors.muted,
                  ),
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: 13,
                    vertical: 11,
                  ),
                ),
              ),
            ),
            // ---------- filter chips ----------
            SizedBox(
              height: 34,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    for (final f in ClientFilter.values) ...[
                      AppFilterChip(
                        label: f.label,
                        selected: state.filter == f,
                        onTap: () => controller.setFilter(f),
                      ),
                      if (f != ClientFilter.values.last)
                        const SizedBox(width: 8),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            // ---------- results ----------
            Expanded(
              child: RefreshIndicator(
                onRefresh: controller.reload,
                child: state.isLoading
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                        children: const [ClientsSkeletonList(itemCount: 5)],
                      )
                    : state.error != null
                    ? _ErrorView(onRetry: () => controller.reload())
                    : results.isEmpty
                    ? _EmptyView(
                        hasQuery:
                            state.query.isNotEmpty ||
                            state.filter != ClientFilter.all,
                        onClear: () {
                          controller.clearSearch();
                          _searchCtrl.clear();
                        },
                        onAdd: () => context.push('/clients/add'),
                      )
                    : ListView.builder(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(16, 2, 16, 90),
                        itemCount: results.length,
                        itemBuilder: (_, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 9),
                          child: ClientCard(
                            client: results[i],
                            onTap: () =>
                                context.push('/clients/${results[i].id}'),
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

// ---------- empty / error ----------

class _EmptyView extends StatelessWidget {
  const _EmptyView({
    required this.hasQuery,
    required this.onClear,
    required this.onAdd,
  });

  final bool hasQuery;
  final VoidCallback onClear;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 80),
        const Icon(
          Icons.person_search_outlined,
          size: 44,
          color: AppColors.muted,
        ),
        const SizedBox(height: 14),
        Center(
          child: Text(
            hasQuery ? 'No clients match' : 'No clients yet',
            style: AppText.body.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            hasQuery
                ? 'Try a different search or filter'
                : 'Invite your first borrower with the + button',
            style: AppText.subText,
          ),
        ),
        const SizedBox(height: 18),
        if (hasQuery)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 80),
            child: OutlinedButton(
              onPressed: onClear,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.blue600,
                side: const BorderSide(color: AppColors.blue600),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
              ),
              child: const Text('Clear search'),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 80),
            child: ElevatedButton(
              onPressed: onAdd,
              child: const Text('Add Client'),
            ),
          ),
      ],
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.cloud_off_outlined, size: 44, color: AppColors.muted),
        const SizedBox(height: 14),
        const Center(child: Text('Could not load clients')),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 80),
          child: ElevatedButton(onPressed: onRetry, child: const Text('Retry')),
        ),
      ],
    );
  }
}
