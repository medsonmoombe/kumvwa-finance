import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

Loan makeLoan({
  double totalDue = 1000,
  double amountPaid = 0,
  CreditRisk? risk,
  List<Installment> schedule = const [],
}) => Loan(
  id: 'LN-1',
  clientId: 'clt_1',
  clientName: 'Mwansa Bwalya',
  lenderName: 'Chilenje Community SACCO',
  nrc: '245711/63/1',
  principal: 850,
  interestRatePct: 15,
  termInstallments: 3,
  totalDue: totalDue,
  amountPaid: amountPaid,
  status: LoanStatus.active,
  schedule: schedule,
  risk: risk,
);

void main() {
  group('Loan.outstanding', () {
    test('is totalDue minus amountPaid', () {
      expect(makeLoan(totalDue: 1000, amountPaid: 250).outstanding, 750);
    });

    test('is zero when fully repaid', () {
      expect(makeLoan(totalDue: 1000, amountPaid: 1000).outstanding, 0);
    });
  });

  group('Loan.progress', () {
    test('is the repaid fraction', () {
      expect(makeLoan(totalDue: 1000, amountPaid: 250).progress, 0.25);
      expect(makeLoan(totalDue: 9775, amountPaid: 6516.6667).progress, closeTo(2 / 3, 0.0001));
    });

    test('is 0 for an untouched loan', () {
      expect(makeLoan(totalDue: 1000).progress, 0.0);
    });

    test('clamps to 1 when overpaid', () {
      expect(makeLoan(totalDue: 1000, amountPaid: 1200).progress, 1.0);
    });

    test('is 0 rather than NaN when totalDue is zero', () {
      expect(makeLoan(totalDue: 0, amountPaid: 0).progress, 0.0);
    });
  });

  group('Loan.nextInstallment / daysUntilDue', () {
    Installment inst(int number, DateTime due, InstallmentStatus status) =>
        Installment(number: number, dueDate: due, amount: 100, status: status);

    test('nextInstallment picks the earliest unpaid installment', () {
      final loan = makeLoan(
        schedule: [
          inst(1, DateTime(2026, 1, 12), InstallmentStatus.paid),
          inst(2, DateTime(2026, 3, 12), InstallmentStatus.upcoming),
          inst(3, DateTime(2026, 2, 12), InstallmentStatus.overdue),
        ],
      );

      expect(loan.nextInstallment!.number, 3);
    });

    test('nextInstallment is null once everything is paid', () {
      final loan = makeLoan(
        schedule: [inst(1, DateTime(2026, 1, 12), InstallmentStatus.paid)],
      );

      expect(loan.nextInstallment, isNull);
      expect(loan.daysUntilDue, isNull);
    });

    test('daysUntilDue counts whole days to the next due date', () {
      final loan = makeLoan(
        schedule: [
          inst(
            1,
            DateTime.now().add(const Duration(days: 5)),
            InstallmentStatus.due,
          ),
        ],
      );

      expect(loan.daysUntilDue, 5);
    });

    test('daysUntilDue is negative when overdue', () {
      final loan = makeLoan(
        schedule: [
          inst(
            1,
            DateTime.now().add(const Duration(days: -3)),
            InstallmentStatus.overdue,
          ),
        ],
      );

      expect(loan.daysUntilDue, -3);
    });
  });

  group('CreditRisk.band', () {
    test('derives the band from the score', () {
      expect(
        CreditRisk(score: 742, source: 'TransUnion Zambia', checkedAt: DateTime(2025, 8, 2)).band,
        RiskLevel.low,
      );
      expect(
        CreditRisk(score: 610, source: 'TransUnion Zambia', checkedAt: DateTime(2025, 7, 20)).band,
        RiskLevel.medium,
      );
      expect(
        CreditRisk(score: 480, source: 'TransUnion Zambia', checkedAt: DateTime(2025, 6, 30)).band,
        RiskLevel.high,
      );
    });

    test('a loan without a risk check has no band', () {
      expect(makeLoan().risk, isNull);
    });
  });

  group('Installment', () {
    test('carries its number, amount, due date and status', () {
      final inst = Installment(
        number: 2,
        dueDate: DateTime(2025, 8, 12),
        amount: 3258.33,
        status: InstallmentStatus.due,
      );

      expect(inst.number, 2);
      expect(inst.amount, 3258.33);
      expect(inst.dueDate, DateTime(2025, 8, 12));
      expect(inst.status, InstallmentStatus.due);
    });
  });
}
