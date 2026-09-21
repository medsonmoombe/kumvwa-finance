import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/grouped_bar_chart.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/core/widgets/stat_card.dart';
import 'package:kumvwa_finance/features/reports/data/reports_repository.dart';
import 'package:kumvwa_finance/features/reports/domain/report_data.dart';

class ReportsScreen extends ConsumerWidget {
  const ReportsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(reportDataProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async => ref.invalidate(reportDataProvider),
          child: async.when(
            loading: () => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: const [
                Row(
                  children: [
                    Expanded(child: Skeleton(height: 58, radius: 13)),
                    SizedBox(width: 8),
                    Expanded(child: Skeleton(height: 58, radius: 13)),
                    SizedBox(width: 8),
                    Expanded(child: Skeleton(height: 58, radius: 13)),
                  ],
                ),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 210, radius: 16),
                SizedBox(height: 11),
                Skeleton(width: double.infinity, height: 150, radius: 16),
              ],
            ),
            error: (_, _) => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                const SizedBox(height: 90),
                const Icon(
                  Icons.cloud_off_outlined,
                  size: 44,
                  color: AppColors.muted,
                ),
                const SizedBox(height: 14),
                const Center(child: Text('Could not load reports')),
                const SizedBox(height: 16),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 80),
                  child: ElevatedButton(
                    onPressed: () => ref.invalidate(reportDataProvider),
                    child: const Text('Retry'),
                  ),
                ),
              ],
            ),
            data: (data) => ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: StatCard(
                        label: 'Disbursed',
                        value: Fmt.money(data.totalDisbursed),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: StatCard(
                        label: 'Collected',
                        value: Fmt.money(data.totalCollected),
                        valueColor: AppColors.green700,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: StatCard(
                        label: 'Outstanding',
                        value: Fmt.money(data.outstanding),
                        valueColor: AppColors.red,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 11),
                _chartCard(data),
                const SizedBox(height: 11),
                _breakdownCard(data),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => _share(data),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.blue600,
                    side: const BorderSide(color: AppColors.blue600),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(13),
                    ),
                    minimumSize: const Size.fromHeight(50),
                  ),
                  icon: const Icon(Icons.ios_share, size: 17),
                  label: const Text('Share Summary'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _chartCard(ReportData data) {
    return Container(
      padding: const EdgeInsets.fromLTRB(15, 13, 15, 15),
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
              Text('Disbursed vs Collected', style: AppText.sectionTitle),
              const Text('Last 6 months', style: AppText.subText),
            ],
          ),
          const SizedBox(height: 12),
          GroupedBarChart(
            groups: [
              for (final m in data.months)
                BarGroup(
                  label: m.label,
                  disbursed: m.disbursed,
                  collected: m.collected,
                ),
            ],
          ),
          const SizedBox(height: 12),
          const ChartLegend(),
        ],
      ),
    );
  }

  Widget _breakdownCard(ReportData data) {
    return Container(
      padding: const EdgeInsets.fromLTRB(15, 13, 15, 15),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Loan Breakdown', style: AppText.sectionTitle),
          const SizedBox(height: 4),
          _row(AppColors.green500, 'Active loans', '${data.activeCount}'),
          _row(AppColors.red, 'Overdue loans', '${data.overdueCount}'),
          _row(AppColors.blue600, 'Cleared loans', '${data.clearedCount}'),
          const Divider(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Repayment rate', style: AppText.body),
              Text(
                '${data.repaymentRatePct.toStringAsFixed(1)}%',
                style: AppText.sectionTitle.copyWith(
                  color: AppColors.green700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(Color color, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Container(
            width: 9,
            height: 9,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: AppText.subText.copyWith(color: AppColors.ink2),
            ),
          ),
          Text(value, style: AppText.body.copyWith(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }

  void _share(ReportData data) {
    final text =
        'Kumvwa Finance — Portfolio Summary\n\n'
        'Disbursed: ${Fmt.money(data.totalDisbursed)}\n'
        'Collected: ${Fmt.money(data.totalCollected)}\n'
        'Outstanding: ${Fmt.money(data.outstanding)}\n'
        'Repayment rate: ${data.repaymentRatePct.toStringAsFixed(1)}%\n\n'
        'Loans — Active: ${data.activeCount} · '
        'Overdue: ${data.overdueCount} · Cleared: ${data.clearedCount}';
    SharePlus.instance.share(
      ShareParams(title: 'Kumvwa Finance report', text: text),
    );
  }
}
