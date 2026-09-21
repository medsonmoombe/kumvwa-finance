/// One month's disbursement vs collection figures.
class MonthlyFigure {
  const MonthlyFigure({
    required this.label,
    required this.disbursed,
    required this.collected,
  });

  final String label; // 'Mar', 'Apr'…
  final double disbursed;
  final double collected;
}

class ReportData {
  const ReportData({
    required this.totalDisbursed,
    required this.totalCollected,
    required this.outstanding,
    required this.repaymentRatePct,
    required this.months,
    required this.activeCount,
    required this.overdueCount,
    required this.clearedCount,
  });

  final double totalDisbursed;
  final double totalCollected;
  final double outstanding;
  final double repaymentRatePct;
  final List<MonthlyFigure> months;
  final int activeCount;
  final int overdueCount;
  final int clearedCount;
}
