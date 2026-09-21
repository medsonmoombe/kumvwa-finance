import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/amount_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/donut_chart.dart';
import 'package:kumvwa_finance/core/widgets/section_card.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/core/widgets/stat_card.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/dashboard/data/dashboard_repository.dart';
import 'package:kumvwa_finance/features/dashboard/domain/dashboard_data.dart';
import 'package:kumvwa_finance/features/notifications/data/notifications_repository.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;
    final dashboard = ref.watch(dashboardDataProvider);
    final unread = ref
            .watch(notificationsProvider('business'))
            .valueOrNull
            ?.where((n) => !n.read)
            .length ??
        0;

    return Scaffold(
      floatingActionButton: FloatingActionButton(
        onPressed: () => context.push('/clients/add'),
        backgroundColor: AppColors.blue600,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Header(displayName: session?.displayName ?? 'My Business', unreadCount: unread),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => ref.invalidate(dashboardDataProvider),
                child: dashboard.when(
                  loading: () => ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
                    children: const [DashboardSkeleton()],
                  ),
                  error: (e, _) => ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(32),
                    children: [
                      const SizedBox(height: 60),
                      const Icon(
                        Icons.cloud_off_outlined,
                        size: 44,
                        color: AppColors.muted,
                      ),
                      const SizedBox(height: 14),
                      const Center(
                        child: Text(
                          'Could not load your dashboard',
                          style: TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: () => ref.invalidate(dashboardDataProvider),
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                  data: (data) => _DashboardBody(data: data),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- fixed header ----------

class _Header extends StatelessWidget {
  const _Header({required this.displayName, required this.unreadCount});

  final String displayName;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
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
              Fmt.initials(displayName),
              style: AppText.caption.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _greeting(),
                  style: AppText.subText,
                ),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        displayName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.sectionTitle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Container(
                      width: 15,
                      height: 15,
                      decoration: const BoxDecoration(
                        color: AppColors.green500,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        size: 9,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Stack(
            children: [
              IconButton(
                onPressed: () => context.push('/notifications'),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.card,
                  side: const BorderSide(color: AppColors.line),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(11),
                  ),
                ),
                icon: const Icon(
                  Icons.notifications_outlined,
                  size: 20,
                  color: AppColors.ink2,
                ),
              ),
              Positioned(
                top: 7,
                right: 7,
                child: unreadCount > 0
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.red,
                          borderRadius: BorderRadius.circular(99),
                          border: Border.all(color: Colors.white, width: 1.5),
                        ),
                        child: Text(
                          '$unreadCount',
                          style: const TextStyle(
                            fontSize: 8.5,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning 👋';
    if (h < 18) return 'Good afternoon 👋';
    return 'Good evening 👋';
  }
}

// ---------- scrollable dashboard ----------

class _DashboardBody extends StatelessWidget {
  const _DashboardBody({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 90),
      children: [
        _HeroCard(data: data),
        const SizedBox(height: 11),
        Row(
          children: [
            Expanded(
              child: StatCard(
                label: 'Active loans',
                value: '${data.activeLoans}',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Due this week',
                value: Fmt.money(data.dueThisWeek),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: StatCard(
                label: 'Overdue',
                value: '${data.overduePercent}%',
                valueColor: AppColors.red,
              ),
            ),
          ],
        ),
        const SizedBox(height: 11),
        SectionCard(
          title: 'Portfolio Health',
          child: Row(
            children: [
              DonutChart(
                segments: [
                  DonutSegment(
                    value: data.healthActive.toDouble(),
                    color: AppColors.green500,
                  ),
                  DonutSegment(
                    value: data.healthRepaid.toDouble(),
                    color: AppColors.blue600,
                  ),
                  DonutSegment(
                    value: data.healthOverdue.toDouble(),
                    color: AppColors.red,
                  ),
                ],
                center: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${data.activeLoans}',
                      style: AppText.sectionTitle,
                    ),
                    const Text('loans', style: AppText.caption),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _legend(AppColors.green500, 'Active', data.healthActive),
                    const SizedBox(height: 7),
                    _legend(AppColors.blue600, 'Repaid', data.healthRepaid),
                    const SizedBox(height: 7),
                    _legend(AppColors.red, 'Overdue', data.healthOverdue),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 11),
        SectionCard(
          title: 'Recent Loans',
          actionLabel: 'View all',
          onAction: () => context.go('/loans'),
          child: Column(
            children: [
              for (final loan in data.recentLoans) _LoanRow(loan: loan),
            ],
          ),
        ),
      ],
    );
  }

  Widget _legend(Color color, String label, int pct) {
    return Row(
      children: [
        Container(
          width: 9,
          height: 9,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 7),
        Text(
          '$label · $pct%',
          style: AppText.subText.copyWith(color: AppColors.ink2),
        ),
      ],
    );
  }
}

// ---------- hero gradient card ----------

class _HeroCard extends StatelessWidget {
  const _HeroCard({required this.data});

  final DashboardData data;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.fromLTRB(17, 15, 17, 15),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.blue600, AppColors.blue900],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -28,
              bottom: -48,
              child: Container(
                width: 126,
                height: 126,
                decoration: BoxDecoration(
                  color: AppColors.green500.withValues(alpha: .22),
                  shape: BoxShape.circle,
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Total Portfolio',
                      style: AppText.subText.copyWith(
                        color: const Color(0xFFAFC3EE),
                      ),
                    ),
                    Text(
                      'This month',
                      style: AppText.subText.copyWith(
                        color: const Color(0xFFAFC3EE),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      Fmt.money(data.totalPortfolio),
                      style: AppText.display,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'ZMW',
                      style: AppText.caption.copyWith(
                        color: const Color(0xFF9FB4E4),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 7),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.green500.withValues(alpha: .2),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    '▲ ${data.trendPercent}% vs last month',
                    style: AppText.caption.copyWith(
                      color: const Color(0xFF7FF0B0),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- recent loan row ----------

class _LoanRow extends StatelessWidget {
  const _LoanRow({required this.loan});

  final RecentLoan loan;

  static const _avatarColors = [
    AppColors.blue500,
    AppColors.green700,
    Color(0xFFB26A00),
    AppColors.red,
  ];

  @override
  Widget build(BuildContext context) {
    final badge = switch (loan.status) {
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
    };

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color:
                  _avatarColors[loan.clientName.codeUnitAt(0) %
                      _avatarColors.length],
              shape: BoxShape.circle,
            ),
            child: Text(
              Fmt.initials(loan.clientName),
              style: AppText.caption.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  loan.clientName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.body,
                ),
                const SizedBox(height: 2),
                Text(
                  'Due ${Fmt.date(loan.dueDate)}',
                  style: AppText.subText,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AmountText(loan.amount),
              const SizedBox(height: 3),
              badge,
            ],
          ),
        ],
      ),
    );
  }
}
