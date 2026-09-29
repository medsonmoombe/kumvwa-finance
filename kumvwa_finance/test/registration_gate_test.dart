import 'package:flutter_test/flutter_test.dart';
import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/onboarding/domain/registration_gate.dart';
import 'package:kumvwa_finance/features/profile/domain/client_profile.dart';

ClientProfile profile({
  String? email = 'a@b.com',
  String? employmentStatus = 'self_employed',
  String? incomeSource = 'Market stall',
  String? educationLevel = 'degree',
  String? incomeBand = 'b1001_3000',
  String? kinName = 'Jane',
  String? kinPhone = '0965550001',
}) => ClientProfile(
  fullName: 'Test Borrower',
  phone: '0972000000',
  email: email,
  employmentStatus: employmentStatus,
  incomeSource: incomeSource,
  educationLevel: educationLevel,
  incomeBand: incomeBand,
  kinName: kinName,
  kinPhone: kinPhone,
  profilePercent: 100,
  complete: true,
);

/// A loan that still owes [outstanding] kwacha of its [totalDue].
Loan loan({required double totalDue, double paid = 0}) => Loan(
  id: 'loan-1',
  clientId: 'client-1',
  clientName: 'Test Borrower',
  lenderName: 'M1 SACCO',
  nrc: '245711/63/1',
  principal: 1000,
  interestRatePct: 10,
  termInstallments: 1,
  totalDue: totalDue,
  amountPaid: paid,
  status: LoanStatus.active,
  schedule: [
    Installment(
      number: 1,
      dueDate: DateTime(2026, 10, 1),
      amount: totalDue,
      status: paid >= totalDue ? InstallmentStatus.paid : InstallmentStatus.due,
    ),
  ],
);

void main() {
  group('missingRegistrationFields', () {
    test('is empty once every required field is on file', () {
      expect(missingRegistrationFields(profile()), isEmpty);
    });

    test('names each field the borrower has not provided', () {
      expect(
        missingRegistrationFields(profile(kinName: null, kinPhone: '  ')),
        [RegistrationField.kinName, RegistrationField.kinPhone],
      );
    });

    test('treats a whitespace-only value as missing', () {
      expect(missingRegistrationFields(profile(email: '   ')), [
        RegistrationField.email,
      ]);
    });

    test('requires a sector from a formally employed borrower', () {
      expect(
        missingRegistrationFields(
          profile(employmentStatus: 'formal_employment', incomeSource: null),
        ),
        [RegistrationField.incomeSource],
      );
    });

    test('does not require a sector from anyone else', () {
      expect(
        missingRegistrationFields(
          profile(employmentStatus: 'farming', incomeSource: null),
        ),
        isEmpty,
      );
    });

    test('returns the fields in stepper order', () {
      final missing = missingRegistrationFields(
        profile(
          email: null,
          employmentStatus: null,
          incomeSource: null,
          educationLevel: null,
          incomeBand: null,
          kinName: null,
          kinPhone: null,
        ),
      );
      // An unknown employment status makes the sector inapplicable, so it is
      // not reported alongside the status itself.
      expect(missing, [
        RegistrationField.email,
        RegistrationField.employmentStatus,
        RegistrationField.educationLevel,
        RegistrationField.incomeBand,
        RegistrationField.kinName,
        RegistrationField.kinPhone,
      ]);
      expect(missing, [
        for (final f in RegistrationField.values)
          if (missing.contains(f)) f,
      ], reason: 'order must follow the stepper, not the enum alone');
    });
  });

  group('evaluateRegistration', () {
    test('a fully registered borrower is let straight in', () {
      final decision = evaluateRegistration(profile: profile());
      expect(decision.action, RegistrationGateAction.complete);
      expect(decision.isComplete, isTrue);
      expect(decision.bindsToStepper, isFalse);
    });

    test('missing fields with no loan binds them to the stepper', () {
      final decision = evaluateRegistration(profile: profile(incomeBand: null));
      expect(decision.action, RegistrationGateAction.completeRegistration);
      expect(decision.bindsToStepper, isTrue);
      expect(decision.missing, [RegistrationField.incomeBand]);
    });

    test('an already-cleared loan does not unlock the stepper', () {
      final decision = evaluateRegistration(
        profile: profile(kinName: null),
        loans: [loan(totalDue: 1000, paid: 1000)],
      );
      expect(decision.action, RegistrationGateAction.completeRegistration);
    });

    test('a loan awaiting repayment lets them clear it first', () {
      final decision = evaluateRegistration(
        profile: profile(kinPhone: null),
        loans: [loan(totalDue: 1000, paid: 200)],
      );
      expect(decision.action, RegistrationGateAction.clearLoanFirst);
      expect(decision.owesThenRegisters, isTrue);
      expect(decision.bindsToStepper, isFalse);
      expect(decision.missing, [RegistrationField.kinPhone]);
      expect(decision.openLoanCount, 1);
      expect(decision.openTotalOutstanding, 800);
    });

    test('a partly paid loan still counts as pending', () {
      final decision = evaluateRegistration(
        profile: profile(educationLevel: null),
        loans: [loan(totalDue: 5000, paid: 4999.99)],
      );
      expect(decision.action, RegistrationGateAction.clearLoanFirst);
    });

    test('debt never overrides a complete registration', () {
      final decision = evaluateRegistration(
        profile: profile(),
        loans: [loan(totalDue: 1000)],
      );
      expect(decision.action, RegistrationGateAction.complete);
      expect(decision.openLoanCount, 1);
    });
  });

  group('evaluateRegistrationFrom (server payload)', () {
    test("uses the fields the server reports missing", () {
      final decision = evaluateRegistrationFrom(
        missing: ['kinName', 'kinPhone'],
      );
      expect(decision.action, RegistrationGateAction.completeRegistration);
      expect(decision.missing, [
        RegistrationField.kinName,
        RegistrationField.kinPhone,
      ]);
    });

    test("ignores fields it doesn't recognise", () {
      final decision = evaluateRegistrationFrom(
        missing: ['somethingElse', 'email'],
      );
      expect(decision.missing, [RegistrationField.email]);
    });

    test("the server's open-loan count grants the clearing pass", () {
      final decision = evaluateRegistrationFrom(
        missing: ['email'],
        openLoanCount: 2,
        openTotalOutstanding: 4200,
      );
      expect(decision.action, RegistrationGateAction.clearLoanFirst);
      expect(decision.openLoanCount, 2);
      expect(decision.openTotalOutstanding, 4200);
    });

    test('an empty missing list is complete regardless of debt', () {
      final decision = evaluateRegistrationFrom(
        missing: const [],
        openLoanCount: 1,
      );
      expect(decision.action, RegistrationGateAction.complete);
    });

    test('falls back to the loaded loans when the server reports none', () {
      final decision = evaluateRegistrationFrom(
        missing: ['email'],
        loans: [loan(totalDue: 900, paid: 100)],
      );
      expect(decision.action, RegistrationGateAction.clearLoanFirst);
      expect(decision.openTotalOutstanding, 800);
    });
  });

  test('RegistrationField maps every server field name', () {
    for (final field in RegistrationField.values) {
      expect(RegistrationField.fromApi(field.name), field);
    }
    expect(RegistrationField.fromApi('nope'), isNull);
  });
}
