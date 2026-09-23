import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
import 'package:kumvwa_finance/features/reports/domain/report_data.dart';

abstract class ReportsRepository {
  Future<ReportData> load();
}

/// Mock data with realistic latency so skeletons are visible in dev.
/// Swap for the API-backed implementation when the backend lands.
class MockReportsRepository implements ReportsRepository {
  @override
  Future<ReportData> load() async {
    await Future<void>.delayed(const Duration(milliseconds: 1100));
    return const ReportData(
      totalDisbursed: 312400,
      totalCollected: 268900,
      outstanding: 43500,
      repaymentRatePct: 86.1,
      months: [
        MonthlyFigure(label: 'Mar', disbursed: 38000, collected: 31000),
        MonthlyFigure(label: 'Apr', disbursed: 42000, collected: 36500),
        MonthlyFigure(label: 'May', disbursed: 51000, collected: 44000),
        MonthlyFigure(label: 'Jun', disbursed: 46500, collected: 47200),
        MonthlyFigure(label: 'Jul', disbursed: 62000, collected: 53800),
        MonthlyFigure(label: 'Aug', disbursed: 72900, collected: 56400),
      ],
      activeCount: 128,
      overdueCount: 19,
      clearedCount: 74,
    );
  }
}

// ---------- API-backed implementation ----------

/// Real reports from `/reports/summary` + `/reports/monthly`.
class ApiReportsRepository implements ReportsRepository {
  ApiReportsRepository(this._client);

  final ApiClient _client;

  @override
  Future<ReportData> load() async {
    final results = await Future.wait([
      _client.getA('/reports/summary'),
      _client.getA('/reports/monthly'),
    ]);
    final summary = results[0].data as Map<String, dynamic>;
    final counts = summary['counts'] as Map<String, dynamic>? ?? const {};
    final monthly = (results[1].data as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .toList();

    final months = <MonthlyFigure>[];
    var windowDisbursed = 0.0;
    var windowCollected = 0.0;
    for (final item in monthly) {
      final disbursed = minorToKwacha(item['disbursedMinor']);
      final collected = minorToKwacha(item['collectedMinor']);
      windowDisbursed += disbursed;
      windowCollected += collected;
      months.add(
        MonthlyFigure(
          label: monthShortLabel(item['month'] as String? ?? ''),
          disbursed: disbursed,
          collected: collected,
        ),
      );
    }

    return ReportData(
      totalDisbursed: _numOf(summary['disbursed']),
      totalCollected: windowCollected,
      outstanding: _numOf(summary['outstanding']),
      repaymentRatePct: windowDisbursed > 0
          ? (windowCollected / windowDisbursed) * 100
          : 0,
      months: months,
      activeCount: _intOf(counts['active']),
      overdueCount: _intOf(counts['overdue']),
      clearedCount: _intOf(counts['cleared']),
    );
  }

  static double _numOf(dynamic value) => value is num ? value.toDouble() : 0;
  static int _intOf(dynamic value) => value is num ? value.toInt() : 0;
}

// ---------- DI ----------

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => Env.useMocks
      ? MockReportsRepository()
      : ApiReportsRepository(ref.watch(apiClientProvider)),
);

final reportDataProvider = FutureProvider<ReportData>(
  (ref) => ref.watch(reportsRepositoryProvider).load(),
);
