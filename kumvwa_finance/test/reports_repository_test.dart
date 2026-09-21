import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/reports/data/reports_repository.dart';
import 'package:kumvwa_finance/features/reports/domain/report_data.dart';

void main() {
  late ReportData data;

  setUpAll(() async => data = await MockReportsRepository().load());

  test('covers the last six months, in order', () {
    expect(data.months, hasLength(6));
    expect(
      data.months.map((m) => m.label),
      ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
    );
  });

  test('every month reports both a disbursed and a collected figure', () {
    for (final m in data.months) {
      expect(m.disbursed, greaterThan(0), reason: m.label);
      expect(m.collected, greaterThan(0), reason: m.label);
    }
  });

  test('outstanding is the uncollected remainder of what was disbursed', () {
    expect(
      data.totalDisbursed - data.totalCollected,
      closeTo(data.outstanding, 0.001),
    );
  });

  test('totals reconcile exactly with the monthly breakdown', () {
    final disbursed = data.months.fold<double>(0, (a, m) => a + m.disbursed);
    final collected = data.months.fold<double>(0, (a, m) => a + m.collected);

    expect(disbursed, closeTo(data.totalDisbursed, 0.001));
    expect(collected, closeTo(data.totalCollected, 0.001));
  });

  test('repayment rate is a sane percentage', () {
    expect(data.repaymentRatePct, greaterThan(0));
    expect(data.repaymentRatePct, lessThanOrEqualTo(100));
  });

  test('loan breakdown counts are positive', () {
    expect(data.activeCount, greaterThan(0));
    expect(data.overdueCount, greaterThan(0));
    expect(data.clearedCount, greaterThan(0));
  });

  test('August is the peak month for both series', () {
    final peakDisbursed = data.months.reduce(
      (a, b) => b.disbursed > a.disbursed ? b : a,
    );
    final peakCollected = data.months.reduce(
      (a, b) => b.collected > a.collected ? b : a,
    );

    expect(peakDisbursed.label, 'Aug');
    expect(peakCollected.label, 'Aug');
  });
}
