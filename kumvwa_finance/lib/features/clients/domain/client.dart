export 'package:kumvwa_finance/core/domain/risk_level.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';

/// One of a client's loans, as shown on the client detail screen.
class ClientLoanSummary {
  const ClientLoanSummary({
    required this.id,
    required this.amount,
    required this.dueDate,
    required this.status,
  });

  final String id;
  final double amount;
  final DateTime dueDate;
  final LoanStatus status;
}

/// A deduped borrower record, keyed on NRC + phone across the platform.
class Client {
  const Client({
    required this.id,
    required this.name,
    required this.nrc,
    required this.phone,
    required this.risk,
    required this.lendersCount,
    required this.loans,
  });

  final String id;
  final String name;
  final String nrc;
  final String phone;
  final RiskLevel risk;
  final int lendersCount;
  final List<ClientLoanSummary> loans;

  bool get hasActiveLoans => loans.any((l) => l.status == LoanStatus.active);
  bool get hasOverdueLoans => loans.any((l) => l.status == LoanStatus.overdue);
}
