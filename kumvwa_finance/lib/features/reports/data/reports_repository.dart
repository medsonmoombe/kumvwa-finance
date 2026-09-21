import 'package:flutter_riverpod/flutter_riverpod.dart';

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

final reportsRepositoryProvider = Provider<ReportsRepository>(
  (ref) => MockReportsRepository(),
);

final reportDataProvider = FutureProvider<ReportData>(
  (ref) => ref.watch(reportsRepositoryProvider).load(),
);
