import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/profile/domain/client_profile.dart';

/// The fields the registration stepper requires, in the order the form asks
/// for them. Mirrors `REGISTRATION_FIELDS` in the API's `clients.service.ts` —
/// the server is the authority, this list drives the app's own comparison and
/// the labels the borrower sees.
enum RegistrationField {
  email('Email address'),
  employmentStatus('Employment status'),
  incomeSource('Employment sector'),
  educationLevel('Education level'),
  incomeBand('Income range'),
  kinName('Next of kin name'),
  kinPhone('Next of kin phone');

  const RegistrationField(this.label);

  /// Human label, shown in the "what's still missing" list.
  final String label;

  static RegistrationField? fromApi(String field) {
    for (final f in RegistrationField.values) {
      if (f.name == field) return f;
    }
    return null;
  }
}

/// What the app should do with a signed-in borrower.
enum RegistrationGateAction {
  /// Every required field is on file — the app is fully unlocked.
  complete,

  /// Required fields are missing and no loan awaits repayment: bind the
  /// borrower to the stepper.
  completeRegistration,

  /// Required fields are missing BUT a loan still awaits repayment. The
  /// borrower is let in to settle the debt first (binding them here would
  /// hide the only screen that can clear it) and is bound to the stepper as
  /// soon as the loan is cleared.
  clearLoanFirst,
}

class RegistrationDecision {
  const RegistrationDecision({
    required this.action,
    this.missing = const [],
    this.openLoanCount = 0,
    this.openTotalOutstanding = 0,
  });

  final RegistrationGateAction action;
  final List<RegistrationField> missing;
  final int openLoanCount;
  final double openTotalOutstanding;

  /// True when the stepper must be shown instead of the app body.
  bool get bindsToStepper =>
      action == RegistrationGateAction.completeRegistration;

  /// True when the borrower may proceed but owes money — the home shows a
  /// "finish your registration" card alongside the pay surface.
  bool get owesThenRegisters => action == RegistrationGateAction.clearLoanFirst;

  /// Unlocked: nothing required is missing.
  bool get isComplete => action == RegistrationGateAction.complete;
}

/// A loan that still has money owed on it.
bool hasPendingRepayment(Loan loan) => loan.outstanding > 0;

/// Compares the borrower's registration info against the stepper's required
/// fields and decides whether to bind them to it.
///
/// The rule: a missing required field binds the borrower to the stepper —
/// UNLESS a loan is still awaiting repayment, in which case they get to clear
/// the loan first and are bound to the stepper immediately after.
RegistrationDecision evaluateRegistration({
  required ClientProfile profile,
  List<Loan> loans = const [],
}) {
  return evaluateRegistrationFrom(
    missing: missingRegistrationFields(profile).map((f) => f.name).toList(),
    loans: loans,
  );
}

/// The same decision, driven by the server's `registration` payload (the
/// fields it reports missing) plus the loans the app already holds. Used on
/// the real API so the borrower is never gated differently from the server's
/// own view of their record.
RegistrationDecision evaluateRegistrationFrom({
  required List<String> missing,
  List<Loan> loans = const [],
  int openLoanCount = 0,
  double openTotalOutstanding = 0,
}) {
  final fields = missing
      .map(RegistrationField.fromApi)
      .whereType<RegistrationField>()
      .toList();

  // A loan with an unpaid balance is the only thing that earns the borrower a
  // pass through the gate. Both sources are honoured — the loans the app holds
  // and the count the server reported — because either one alone can be stale.
  final local = loans.where(hasPendingRepayment);
  final openCount = local.isNotEmpty ? local.length : openLoanCount;
  final openTotal = openTotalOutstanding > 0
      ? openTotalOutstanding
      : local.fold<double>(0, (sum, loan) => sum + loan.outstanding);

  if (fields.isEmpty) {
    return RegistrationDecision(
      action: RegistrationGateAction.complete,
      openLoanCount: openCount,
      openTotalOutstanding: openTotal,
    );
  }

  if (openCount > 0) {
    return RegistrationDecision(
      action: RegistrationGateAction.clearLoanFirst,
      missing: fields,
      openLoanCount: openCount,
      openTotalOutstanding: openTotal,
    );
  }

  return RegistrationDecision(
    action: RegistrationGateAction.completeRegistration,
    missing: fields,
  );
}

/// Every required field the borrower has not provided yet, in form order.
/// A field counts as provided when the server has a non-blank value for it.
List<RegistrationField> missingRegistrationFields(ClientProfile p) {
  final values = <RegistrationField, String?>{
    RegistrationField.email: p.email,
    RegistrationField.employmentStatus: p.employmentStatus,
    // Mirrors the stepper: only a formally employed borrower must name their
    // sector, so it is not required for anyone else.
    RegistrationField.incomeSource: p.employmentStatus == 'formal_employment'
        ? p.incomeSource
        : 'not required',
    RegistrationField.educationLevel: p.educationLevel,
    RegistrationField.incomeBand: p.incomeBand,
    RegistrationField.kinName: p.kinName,
    RegistrationField.kinPhone: p.kinPhone,
  };

  return [
    for (final entry in values.entries)
      if (entry.value == null || entry.value!.trim().isEmpty) entry.key,
  ];
}
