import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';

enum InstallmentStatus { paid, due, overdue, upcoming }

class Installment {
  const Installment({
    required this.number,
    required this.dueDate,
    required this.amount,
    required this.status,
  });

  final int number;
  final DateTime dueDate;
  final double amount;
  final InstallmentStatus status;
}

/// Bureau-sourced credit risk attached to a borrower at loan time.
class CreditRisk {
  const CreditRisk({
    required this.score,
    required this.source,
    required this.checkedAt,
  });

  final int score; // 300–850
  final String source; // e.g. 'TransUnion Zambia'
  final DateTime checkedAt;

  RiskLevel get band => RiskLevelX.fromScore(score);
}

class Loan {
  const Loan({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.lenderName,
    required this.nrc,
    required this.principal,
    required this.interestRatePct,
    required this.termInstallments,
    required this.totalDue,
    required this.amountPaid,
    required this.status,
    required this.schedule,
    this.risk,
  });

  final String id;
  final String clientId;
  final String clientName;
  final String lenderName;
  final String nrc;
  final double principal;
  final double interestRatePct;
  final int termInstallments;
  final double totalDue;
  final double amountPaid;
  final LoanStatus status;
  final List<Installment> schedule;

  /// Bureau risk — null when no credit check has been run yet.
  final CreditRisk? risk;

  double get outstanding => totalDue - amountPaid;
  double get progress =>
      totalDue > 0 ? (amountPaid / totalDue).clamp(0.0, 1.0) : 0.0;

  /// Earliest unpaid installment — the one a payment will settle next.
  Installment? get nextInstallment {
    final unpaid =
        schedule.where((i) => i.status != InstallmentStatus.paid).toList();
    if (unpaid.isEmpty) return null;
    unpaid.sort((a, b) => a.dueDate.compareTo(b.dueDate));
    return unpaid.first;
  }

  /// Whole days until the next installment (-ve = overdue). Null when cleared.
  int? get daysUntilDue {
    final next = nextInstallment;
    if (next == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final due = DateTime(
      next.dueDate.year,
      next.dueDate.month,
      next.dueDate.day,
    );
    return due.difference(today).inDays;
  }
}
