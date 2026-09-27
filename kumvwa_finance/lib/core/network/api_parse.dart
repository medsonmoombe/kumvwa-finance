import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';
import 'package:kumvwa_finance/core/time/zambia_time.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';

// Canonical field mappings between the API and the app's domain models.
//
// Money convention on the backend: every amount appears twice — a kwacha
// number (`principal`, `paidAmount`…) and a string of ngwee (`*Minor`,
// e.g. `"40000"`). Most mobile surfaces read kwacha numbers, but the
// client-facing loan detail is minor-only, so we keep both parsers.

/// `0XXXXXXXXX` (or `+260` prefixed) → `+260XXXXXXXXX`, the form the API
/// stores and matches.
String toE164(String phone) {
  final p = phone.replaceAll(RegExp(r'[\s()\-]'), '');
  if (p.startsWith('+260')) return p;
  if (p.startsWith('260')) return '+$p';
  if (p.startsWith('0')) return '+260${p.substring(1)}';
  return '+260$p';
}

String? _string(dynamic value) => value is String ? value : null;

double _num(dynamic value) => value is num ? value.toDouble() : 0;

/// ngwee string like `"40000"` → kwacha `400.0`.
double minorToKwacha(dynamic value) {
  final raw = _string(value);
  if (raw == null) return 0;
  final minor = int.tryParse(raw);
  return minor == null ? 0 : minor / 100;
}

double? _optionalNum(dynamic value) => value is num ? value.toDouble() : null;

DateTime? isoDate(dynamic value) {
  final raw = _string(value);
  return raw == null ? null : DateTime.tryParse(raw);
}

LoanStatus toLoanStatus(String? value) => switch (value) {
  'cleared' => LoanStatus.cleared,
  'defaulted' => LoanStatus.overdue,
  'active' => LoanStatus.active,
  _ => LoanStatus.active,
};

InstallmentStatus toInstallmentStatus(String? value, DateTime? dueDate) {
  switch (value) {
    case 'paid':
      return InstallmentStatus.paid;
    case 'overdue':
      return InstallmentStatus.overdue;
    case 'pending':
      // Pending becomes overdue once the ZAMBIAN day is past the due date.
      if (dueDate != null && dateOnly(dueDate).isBefore(zambiaToday())) {
        return InstallmentStatus.overdue;
      }
      return InstallmentStatus.due;
    default:
      return InstallmentStatus.upcoming;
  }
}

RiskLevel toRiskLevel(String? value) => switch (value) {
  'high' => RiskLevel.high,
  'medium' => RiskLevel.medium,
  _ => RiskLevel.low,
};

LoanRequestStatus toLoanRequestStatus(String? value) => switch (value) {
  'approved' => LoanRequestStatus.approved,
  'rejected' => LoanRequestStatus.rejected,
  _ => LoanRequestStatus.pending,
};

NotificationType toNotificationType(String? value) => switch (value) {
  'payment_received' => NotificationType.paymentReceived,
  'loan_overdue' => NotificationType.loanOverdue,
  'verification' => NotificationType.verification,
  'client_activity' => NotificationType.clientActivity,
  'loan_request' => NotificationType.loanRequest,
  'request_approved' => NotificationType.requestApproved,
  'request_rejected' => NotificationType.requestRejected,
  'payment_due' => NotificationType.paymentDue,
  _ => NotificationType.system,
};

/// API roles → the app's two shells ('business' | 'client').
String toAppRole(String role) => switch (role) {
  'tenant_owner' || 'tenant_staff' || 'platform_admin' => 'business',
  'client' => 'client',
  _ => role,
};

/// Short month label for report charts: `"2025-08"` → `"Aug"`.
String monthShortLabel(String month) {
  final date = DateTime.tryParse(month) ?? DateTime.tryParse('$month-01');
  if (date == null) return month;
  const names = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return names[date.month - 1];
}

({double amount, DateTime? dueDate}) parseNextDue(
  dynamic amountMinor,
  dynamic dueDate,
) => (amount: minorToKwacha(amountMinor), dueDate: isoDate(dueDate));

double outstandingOf(Map<String, dynamic> json) {
  final direct = _optionalNum(json['outstanding']);
  if (direct != null) return direct;
  final due = _num(json['totalDue']);
  final paid = _num(json['paidAmount']) != 0
      ? _num(json['paidAmount'])
      : _num(json['paid']);
  return due - paid;
}
