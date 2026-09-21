import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/dashboard/data/dashboard_repository.dart';
import 'package:kumvwa_finance/features/dashboard/domain/dashboard_data.dart';

void main() {
  late DashboardData data;

  setUpAll(() async => data = await MockDashboardRepository().load());

  test('health bands are percentages that add up to 100', () {
    expect(data.healthActive + data.healthRepaid + data.healthOverdue, 100);
  });

  test('headline figures are populated', () {
    expect(data.totalPortfolio, greaterThan(0));
    expect(data.activeLoans, greaterThan(0));
    expect(data.dueThisWeek, greaterThan(0));
    expect(data.overduePercent, greaterThan(0));
    expect(data.trendPercent, greaterThan(0));
  });

  test('recent loans carry an id, borrower, amount and status', () {
    expect(data.recentLoans, hasLength(3));

    for (final loan in data.recentLoans) {
      expect(loan.id, startsWith('LN-'));
      expect(loan.clientName, isNotEmpty);
      expect(loan.amount, greaterThan(0));
    }
  });

  test('recent loans cover active and overdue states', () {
    expect(
      data.recentLoans.where((l) => l.status == LoanStatus.active),
      hasLength(2),
    );
    expect(
      data.recentLoans.where((l) => l.status == LoanStatus.overdue),
      hasLength(1),
    );
  });

  test('LoanStatus is re-exported from the dashboard domain', () {
    expect(LoanStatus.values, hasLength(3));
  });
}
