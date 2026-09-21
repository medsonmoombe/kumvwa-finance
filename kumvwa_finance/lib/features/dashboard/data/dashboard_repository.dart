import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/dashboard/domain/dashboard_data.dart';

abstract class DashboardRepository {
  Future<DashboardData> load();
}

/// Mock data with realistic latency so the skeletons are visible in dev.
/// Swap for the API-backed implementation when the backend lands.
class MockDashboardRepository implements DashboardRepository {
  @override
  Future<DashboardData> load() async {
    await Future<void>.delayed(const Duration(milliseconds: 1200));
    // NOTE: not `const` — DateTime has no const constructor.
    return DashboardData(
      totalPortfolio: 245800,
      trendPercent: 12.5,
      activeLoans: 128,
      dueThisWeek: 18400,
      overduePercent: 6.2,
      healthActive: 62,
      healthRepaid: 23,
      healthOverdue: 15,
      recentLoans: [
        RecentLoan(
          id: 'LN-2025-00841',
          clientName: 'Mwansa Bwalya',
          amount: 8500,
          dueDate: DateTime(2025, 8, 12),
          status: LoanStatus.active,
        ),
        RecentLoan(
          id: 'LN-2025-00836',
          clientName: 'Chanda Nkhoma',
          amount: 3200,
          dueDate: DateTime(2025, 7, 28),
          status: LoanStatus.overdue,
        ),
        RecentLoan(
          id: 'LN-2025-00829',
          clientName: 'Grace Lungu',
          amount: 5100,
          dueDate: DateTime(2025, 7, 30),
          status: LoanStatus.active,
        ),
      ],
    );
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => MockDashboardRepository(),
);

final dashboardDataProvider = FutureProvider<DashboardData>(
  (ref) => ref.watch(dashboardRepositoryProvider).load(),
);
