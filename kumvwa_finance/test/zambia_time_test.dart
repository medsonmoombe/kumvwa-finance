import 'package:flutter_test/flutter_test.dart';
import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/time/zambia_time.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

void main() {
  group('zambiaNow', () {
    test('reads two hours ahead of UTC', () {
      final z = zambiaNow(DateTime.utc(2026, 9, 27, 22, 30));
      expect(z.year, 2026);
      expect(z.month, 9);
      expect(z.day, 28, reason: 'already the 28th in Lusaka');
      expect(z.hour, 0);
      expect(z.minute, 30);
    });

    test('keeps the same calendar day before 22:00 UTC', () {
      final z = zambiaNow(DateTime.utc(2026, 9, 27, 21, 59));
      expect(z.day, 27);
      expect(z.hour, 23);
      expect(z.minute, 59);
    });
  });

  group('zambiaToday', () {
    test('is the Lusaka date even when UTC has rolled over', () {
      final t = zambiaToday(DateTime.utc(2026, 9, 27, 22, 30));
      expect(t, DateTime(2026, 9, 28));
    });

    test('is midnight, so it subtracts cleanly', () {
      final t = zambiaToday(DateTime.utc(2026, 9, 27, 9));
      expect(t.hour, 0);
      expect(t.minute, 0);
    });
  });

  group('dateOnly', () {
    test('strips the time from a local value', () {
      expect(dateOnly(DateTime(2026, 9, 27, 23, 59)), DateTime(2026, 9, 27));
    });

    test('leaves a date-only value alone', () {
      expect(dateOnly(DateTime(2026, 10, 27)), DateTime(2026, 10, 27));
    });
  });

  group('daysUntilZambianDate', () {
    test('counts a one-month loan as 30 days from the 27th', () {
      // The reported case: drawn 27 Sept, due 27 Oct.
      expect(
        daysUntilZambianDate(
          DateTime(2026, 10, 27),
          DateTime.utc(2026, 9, 27, 11),
        ),
        30,
      );
    });

    test('is 0 on the due date, not 1', () {
      expect(
        daysUntilZambianDate(
          DateTime(2026, 10, 27),
          DateTime.utc(2026, 10, 27, 8),
        ),
        0,
      );
    });

    test('goes negative once the day has passed', () {
      expect(
        daysUntilZambianDate(
          DateTime(2026, 10, 27),
          DateTime.utc(2026, 10, 28, 8),
        ),
        -1,
      );
    });

    test('ignores the time of day on the due date', () {
      expect(
        daysUntilZambianDate(
          DateTime(2026, 10, 27, 23, 59),
          DateTime.utc(2026, 10, 27, 8),
        ),
        0,
      );
    });
  });

  group('Loan.daysUntilDue', () {
    Loan loanWith(DateTime dueDate) => Loan(
      id: 'l1',
      clientId: 'c1',
      clientName: 'Test',
      lenderName: 'M1 SACCO',
      nrc: '245711/63/1',
      principal: 1000,
      interestRatePct: 10,
      termInstallments: 1,
      totalDue: 1100,
      amountPaid: 0,
      status: LoanStatus.active,
      schedule: [
        Installment(
          number: 1,
          dueDate: dueDate,
          amount: 1100,
          status: InstallmentStatus.due,
        ),
      ],
    );

    test('reports the whole term, not a truncated one', () {
      final loan = loanWith(DateTime(2026, 10, 27));
      expect(loan.daysUntilDue, isNotNull);
      // Whatever "now" is when this runs, the difference from the Zambia date
      // is exactly what the schedule says.
      expect(loan.daysUntilDue, daysUntilZambianDate(DateTime(2026, 10, 27)));
    });

    test('is null once every installment is settled', () {
      final settled = Loan(
        id: 'l1',
        clientId: 'c1',
        clientName: 'Test',
        lenderName: 'M1 SACCO',
        nrc: '245711/63/1',
        principal: 1000,
        interestRatePct: 10,
        termInstallments: 1,
        totalDue: 1100,
        amountPaid: 1100,
        status: LoanStatus.cleared,
        schedule: [
          Installment(
            number: 1,
            dueDate: DateTime(2026, 10, 27),
            amount: 1100,
            status: InstallmentStatus.paid,
          ),
        ],
      );
      expect(settled.daysUntilDue, isNull);
    });
  });
}
