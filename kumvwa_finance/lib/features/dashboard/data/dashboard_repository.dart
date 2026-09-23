import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
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

// ---------- API-backed implementation ----------

/// Real dashboard from `/reports/summary` + `/reports/monthly`.
class ApiDashboardRepository implements DashboardRepository {
  ApiDashboardRepository(this._client);

  final ApiClient _client;

  @override
  Future<DashboardData> load() async {
    final results = await Future.wait([
      _client.getA('/reports/summary'),
      _client.getA('/reports/monthly'),
    ]);
    final summary = results[0].data as Map<String, dynamic>;
    final counts = summary['counts'] as Map<String, dynamic>? ?? const {};
    final monthly = (results[1].data as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

    final activeLoans = _intOf(counts['active']);
    final overdue = _intOf(counts['overdue']);
    final cleared = _intOf(counts['cleared']);

    final recent = <RecentLoan>[];
    for (final item
        in (summary['recentLoans'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()) {
      recent.add(
        RecentLoan(
          id: item['id'] as String? ?? '',
          clientName: item['clientName'] as String? ?? '',
          amount: _numOf(item['principal']),
          dueDate: isoDate(item['createdAt']) ?? DateTime.now(),
          status: toLoanStatus(item['status'] as String?),
        ),
      );
    }

    // month-over-month disbursement trend — the closest real signal to the
    // mock's "portfolio growth" figure.
    var trend = 0.0;
    if (monthly.length >= 2) {
      final last = minorToKwacha(monthly.last['disbursedMinor']);
      final prev = minorToKwacha(monthly[monthly.length - 2]['disbursedMinor']);
      if (prev > 0) trend = ((last - prev) / prev) * 100;
    }

    return DashboardData(
      totalPortfolio: _numOf(summary['outstanding']),
      trendPercent: trend,
      activeLoans: activeLoans,
      // The API reports monthly, not weekly — dueThisMonth is the closest
      // available figure for the "upcoming collections" card.
      dueThisWeek: _numOf(summary['dueThisMonth']),
      overduePercent: activeLoans > 0 ? overdue * 100 / activeLoans : 0,
      healthActive: activeLoans,
      healthRepaid: cleared,
      healthOverdue: overdue,
      recentLoans: recent,
    );
  }

  static int _intOf(dynamic value) => value is num ? value.toInt() : 0;
  static double _numOf(dynamic value) => value is num ? value.toDouble() : 0;
}

// ---------- DI ----------

final dashboardRepositoryProvider = Provider<DashboardRepository>(
  (ref) => Env.useMocks
      ? MockDashboardRepository()
      : ApiDashboardRepository(ref.watch(apiClientProvider)),
);

final dashboardDataProvider = FutureProvider<DashboardData>(
  (ref) => ref.watch(dashboardRepositoryProvider).load(),
);
