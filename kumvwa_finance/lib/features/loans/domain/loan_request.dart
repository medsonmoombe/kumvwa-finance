/// Lifecycle of a borrower-initiated loan application.
enum LoanRequestStatus { pending, approved, rejected }

extension LoanRequestStatusX on LoanRequestStatus {
  String get label => switch (this) {
        LoanRequestStatus.pending => 'Pending',
        LoanRequestStatus.approved => 'Approved',
        LoanRequestStatus.rejected => 'Declined',
      };
}

/// A borrower-initiated loan application, sent to one lender.
/// Lender approves (→ creates a Loan) or rejects (→ with feedback).
class LoanRequest {
  const LoanRequest({
    required this.id,
    required this.clientId,
    required this.clientName,
    required this.nrc,
    required this.phone,
    required this.lenderId,
    required this.lenderName,
    required this.amount,
    required this.termInstallments,
    required this.purpose,
    required this.requestedAt,
    this.status = LoanRequestStatus.pending,
    this.feedback,
    this.reviewedAt,
  });

  final String id;
  final String clientId;
  final String clientName;
  final String nrc;
  final String phone;
  final String lenderId;
  final String lenderName;
  final double amount;
  final int termInstallments;
  final String purpose;
  final DateTime requestedAt;
  final LoanRequestStatus status;

  /// Lender's rejection feedback — always set when rejected.
  final String? feedback;
  final DateTime? reviewedAt;
}
