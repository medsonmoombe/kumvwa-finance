import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/section_card.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client.dart';

class ClientDetailScreen extends ConsumerWidget {
  const ClientDetailScreen({super.key, required this.clientId});

  final String clientId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(clientByIdProvider(clientId));

    return Scaffold(
      appBar: AppBar(title: const Text('Client')),
      body: SafeArea(
        child: async.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                SkeletonCard(),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 120, radius: 16),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 150, radius: 16),
              ],
            ),
          ),
          error: (_, _) => Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.person_off_outlined,
                  size: 44,
                  color: AppColors.muted,
                ),
                const SizedBox(height: 14),
                const Text('Client not found'),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.invalidate(clientByIdProvider(clientId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
          data: (client) => _Body(client: client),
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.client});

  final Client client;

  @override
  Widget build(BuildContext context) {
    final badge = switch (client.risk) {
      RiskLevel.low => const AppBadge('Low risk', variant: BadgeVariant.green),
      RiskLevel.medium => const AppBadge('Medium', variant: BadgeVariant.amber),
      RiskLevel.high => const AppBadge('High risk', variant: BadgeVariant.red),
    };

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        // ---------- profile card ----------
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            children: [
              Container(
                width: 52,
                height: 52,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [AppColors.blue500, AppColors.blue900],
                  ),
                  shape: BoxShape.circle,
                ),
                child: Text(
                  Fmt.initials(client.name),
                  style: AppText.body.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      client.name,
                      style: AppText.sectionTitle,
                    ),
                    const SizedBox(height: 3),
                    Text('NRC ${client.nrc}', style: AppText.subText),
                    Text(client.phone, style: AppText.subText),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 11),
        // ---------- risk + reach row ----------
        Row(
          children: [
            Expanded(child: _MiniStat(label: 'Credit risk', child: badge)),
            const SizedBox(width: 8),
            Expanded(
              child: _MiniStat(
                label: 'Lenders',
                child: Text(
                  '${client.lendersCount}',
                  style: AppText.sectionTitle,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MiniStat(
                label: 'Loans',
                child: Text(
                  '${client.loans.length}',
                  style: AppText.sectionTitle,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 11),
        // ---------- loans ----------
        SectionCard(
          title: 'Loans',
          child: client.loans.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Center(
                    child: Text(
                      'No loans yet for this client',
                      style: AppText.subText,
                    ),
                  ),
                )
              : Column(
                  children: [
                    for (final loan in client.loans)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(10),
                          onTap: () =>
                              context.push('/loans/${loan.id}'),
                          child: Row(
                            children: [
                              Container(
                                width: 31,
                                height: 31,
                                decoration: BoxDecoration(
                                  color: loan.status == LoanStatus.overdue
                                      ? AppColors.red50
                                      : AppColors.blue50,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(
                                  loan.status == LoanStatus.cleared
                                      ? Icons.check
                                      : Icons.description_outlined,
                                  size: 15,
                                  color: loan.status == LoanStatus.overdue
                                      ? AppColors.red
                                      : AppColors.blue600,
                                ),
                              ),
                              const SizedBox(width: 11),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      loan.id,
                                      style: AppText.body.copyWith(
                                        fontWeight: FontWeight.w700,
                                        decoration: TextDecoration.underline,
                                        decorationColor: AppColors.blue600,
                                        color: AppColors.blue600,
                                      ),
                                    ),
                                    Text(
                                      'Due ${Fmt.date(loan.dueDate)} '
                                      '· tap for details',
                                      style: AppText.subText.copyWith(
                                        fontSize: 9.5,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 8),
                              AmountText(loan.amount),
                              const SizedBox(width: 8),
                              switch (loan.status) {
                                LoanStatus.active => const AppBadge(
                                  'Active',
                                  variant: BadgeVariant.green,
                                ),
                                LoanStatus.overdue => const AppBadge(
                                  'Overdue',
                                  variant: BadgeVariant.red,
                                ),
                                LoanStatus.cleared => const AppBadge(
                                  'Cleared',
                                  variant: BadgeVariant.blue,
                                ),
                              },
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppText.caption),
          const SizedBox(height: 4),
          child,
        ],
      ),
    );
  }
}
