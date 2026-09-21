export 'package:kumvwa_finance/core/domain/loan_status.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';

class RecentLoan {
  const RecentLoan({
    required this.id,
    required this.clientName,
    required this.amount,
    required this.dueDate,
    required this.status,
  });

  final String id;
  final String clientName;
  final double amount;
  final DateTime dueDate;
  final LoanStatus status;
}

class DashboardData {
  const DashboardData({
    required this.totalPortfolio,
    required this.trendPercent,
    required this.activeLoans,
    required this.dueThisWeek,
    required this.overduePercent,
    required this.healthActive,
    required this.healthRepaid,
    required this.healthOverdue,
    required this.recentLoans,
  });

  final double totalPortfolio;
  final double trendPercent;
  final int activeLoans;
  final double dueThisWeek;
  final double overduePercent;
  final int healthActive;
  final int healthRepaid;
  final int healthOverdue;
  final List<RecentLoan> recentLoans;
}
