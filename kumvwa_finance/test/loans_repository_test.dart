import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

void main() {
  late MockLoansRepository repo;

  setUp(() => repo = MockLoansRepository());

  group('load / getById', () {
    test('load returns the 8 seeded loans with unique ids', () async {
      final loans = await repo.load();

      expect(loans, hasLength(8));
      expect(loans.map((l) => l.id).toSet(), hasLength(8));
    });

    test('the ledger mixes 4 active, 3 overdue and 1 cleared loan', () async {
      final loans = await repo.load();

      expect(loans.where((l) => l.status == LoanStatus.active), hasLength(4));
      expect(loans.where((l) => l.status == LoanStatus.overdue), hasLength(3));
      expect(loans.where((l) => l.status == LoanStatus.cleared), hasLength(1));
    });

    test('every loan names its lender', () async {
      final loans = await repo.load();

      expect(loans.every((l) => l.lenderName.isNotEmpty), isTrue);
      expect(
        loans.where((l) => l.lenderName == 'Chilenje Community SACCO'),
        hasLength(7),
      );
      // Mwansa's second loan demonstrates the multi-lender client view.
      expect(
        (await repo.getById('LN-2025-00210')).lenderName,
        'Zamuka Savings & Credit',
      );
    });

    test('the demo client has loans from two different lenders', () async {
      final loans = await repo.load();
      final mwansas = loans.where((l) => l.clientId == 'clt_001').toList();

      expect(mwansas, hasLength(2));
      expect(mwansas.map((l) => l.lenderName).toSet(), hasLength(2));
    });

    test('getById returns the matching loan', () async {
      final loan = await repo.getById('LN-2025-00841');

      expect(loan.clientName, 'Mwansa Bwalya');
      expect(loan.clientId, 'clt_001');
      expect(loan.nrc, '245711/63/1');
    });

    test('getById throws StateError for an unknown id', () async {
      expect(() => repo.getById('LN-NOPE'), throwsStateError);
    });
  });

  group('schedule generation', () {
    test('makes one installment per term, numbered from 1', () async {
      final loan = await repo.getById('LN-2025-00841'); // 3 installments

      expect(loan.schedule, hasLength(3));
      expect(loan.schedule.map((i) => i.number), [1, 2, 3]);
    });

    test('totalDue applies the interest rate to the principal', () async {
      final loan = await repo.getById('LN-2025-00841'); // 8500 @ 15%

      expect(loan.principal, 8500);
      expect(loan.interestRatePct, 15);
      expect(loan.totalDue, closeTo(9775, 0.0001));
    });

    test('installment amounts sum back to totalDue', () async {
      for (final id in ['LN-2025-00841', 'LN-2025-00836', 'LN-2025-00780']) {
        final loan = await repo.getById(id);
        final sum = loan.schedule.fold<double>(0, (a, i) => a + i.amount);
        expect(sum, closeTo(loan.totalDue, 0.0001), reason: id);
      }
    });

    test('the first paidCount installments are marked paid', () async {
      final loan = await repo.getById('LN-2025-00841'); // paidCount 2 of 3

      expect(loan.schedule[0].status, InstallmentStatus.paid);
      expect(loan.schedule[1].status, InstallmentStatus.paid);
      expect(loan.amountPaid, closeTo(9775 / 3 * 2, 0.0001));
      expect(loan.progress, closeTo(2 / 3, 0.0001));
    });

    test('a fully repaid loan has every installment paid', () async {
      final loan = await repo.getById(
        'LN-2025-00690',
      ); // Tamara, paidCount == term

      expect(loan.status, LoanStatus.cleared);
      expect(
        loan.schedule.every((i) => i.status == InstallmentStatus.paid),
        isTrue,
      );
      expect(loan.progress, closeTo(1, 0.0001));
      expect(loan.outstanding, closeTo(0, 0.0001));
    });

    test('installments due in an earlier month are overdue', () async {
      // Chanda started 2 months ago and has paid 1 of 2 installments, so the
      // second fell due last month and is unambiguously in the past.
      final loan = await repo.getById('LN-2025-00836');

      expect(loan.schedule[0].status, InstallmentStatus.paid);
      expect(loan.schedule[1].status, InstallmentStatus.overdue);
    });

    test('every unpaid installment is due, overdue or upcoming', () async {
      final loans = await repo.load();

      for (final loan in loans) {
        for (final inst in loan.schedule) {
          expect(
            inst.status,
            anyOf(
              InstallmentStatus.paid,
              InstallmentStatus.due,
              InstallmentStatus.overdue,
              InstallmentStatus.upcoming,
            ),
          );
        }
      }
    });

    test('schedules are ordered by due date', () async {
      final loan = await repo.getById('LN-2025-00780');

      for (var i = 1; i < loan.schedule.length; i++) {
        expect(
          loan.schedule[i].dueDate.isAfter(loan.schedule[i - 1].dueDate),
          isTrue,
        );
      }
    });
  });

  group('bureau risk', () {
    test('only the newest loans have no credit check', () async {
      final loans = await repo.load();

      expect(loans.where((l) => l.risk == null).map((l) => l.id).toSet(), {
        'LN-2025-00860',
        'LN-2025-00210',
      });
    });

    test('bands follow the seeded scores', () async {
      expect(
        (await repo.getById('LN-2025-00841')).risk!.band,
        RiskLevel.low,
      ); // 742
      expect(
        (await repo.getById('LN-2025-00836')).risk!.band,
        RiskLevel.medium,
      ); // 610
      expect(
        (await repo.getById('LN-2025-00780')).risk!.band,
        RiskLevel.high,
      ); // 480
      expect(
        (await repo.getById('LN-2025-00755')).risk!.band,
        RiskLevel.high,
      ); // 520
      expect(
        (await repo.getById('LN-2025-00690')).risk!.band,
        RiskLevel.medium,
      ); // 690
    });
    test('records the bureau source', () async {
      expect(
        (await repo.getById('LN-2025-00841')).risk!.source,
        'TransUnion Zambia',
      );
      expect(
        (await repo.getById('LN-2025-00847')).risk!.source,
        'Experian Zambia',
      );
    });
  });

  group('recordPayment', () {
    test(
      'settles the next unpaid installment and advances the balance',
      () async {
        final before = await repo.getById('LN-2025-00841'); // 2 of 3 paid
        final next = before.nextInstallment!;

        final after = await repo.recordPayment(
          'LN-2025-00841',
          amount: next.amount,
        );

        expect(
          after.schedule.firstWhere((i) => i.number == next.number).status,
          InstallmentStatus.paid,
        );
        expect(
          after.amountPaid,
          closeTo(before.amountPaid + next.amount, 0.0001),
        );
        expect(
          after.outstanding,
          closeTo(before.outstanding - next.amount, 0.0001),
        );
        // Mwansa's loan has 3 installments with 2 paid: settling the last
        // one clears it (the seed's final installment is already in the past,
        // so 'next' here is the third and final one).
      },
    );

    test('mutates the shared store — getById reflects the payment', () async {
      final before = await repo.getById(
        'LN-2025-00860',
      ); // 1 installment, unpaid

      await repo.recordPayment('LN-2025-00860', amount: before.totalDue);
      final after = await repo.getById('LN-2025-00860');

      expect(
        after.amountPaid,
        closeTo(before.amountPaid + before.totalDue, 0.0001),
      );
    });

    test('flips a loan to cleared once the schedule is fully paid', () async {
      await repo.recordPayment('LN-2025-00860', amount: 1); // term of 1 → done

      final loan = await repo.getById('LN-2025-00860');

      expect(loan.status, LoanStatus.cleared);
      expect(loan.nextInstallment, isNull);
      expect(loan.daysUntilDue, isNull);
      expect(loan.outstanding, closeTo(0, 0.0001));
    });

    test('paying the only open installment clears the loan', () async {
      // Bupe's loan: term of 1, nothing paid — one payment finishes it.
      final before = await repo.getById('LN-2025-00860');
      expect(before.nextInstallment, isNotNull);

      final after = await repo.recordPayment('LN-2025-00860', amount: 1);

      expect(
        after.schedule.every((i) => i.status == InstallmentStatus.paid),
        isTrue,
      );
      expect(after.status, LoanStatus.cleared);
      expect(after.nextInstallment, isNull);
    });

    test('refuses to pay an already-cleared loan', () async {
      await expectLater(
        repo.recordPayment('LN-2025-00690', amount: 1), // Tamara, cleared
        throwsStateError,
      );
    });

    test('refuses an unknown loan id', () async {
      await expectLater(
        repo.recordPayment('LN-NOPE', amount: 1),
        throwsStateError,
      );
    });
  });

  group('rollover', () {
    test(
      'moves unpaid dates +1 month and appends the interest share',
      () async {
        final before = await repo.getById('LN-2025-00841'); // 3 installments
        final share =
            before.principal *
            before.interestRatePct /
            100 /
            before.termInstallments;
        final movedFrom = before.schedule[2].dueDate; // the unpaid installment

        final after = await repo.rollover('LN-2025-00841');

        expect(after.rolloverCount, 1);
        expect(after.schedule, hasLength(4));
        // Settled history keeps its dates…
        expect(after.schedule[0].dueDate, before.schedule[0].dueDate);
        expect(after.schedule[1].dueDate, before.schedule[1].dueDate);
        // …the unpaid installment moves exactly one calendar month…
        final movedTo = after.schedule[2].dueDate;
        expect(
          DateTime(movedTo.year, movedTo.month - 1, movedTo.day),
          DateTime(movedFrom.year, movedFrom.month, movedFrom.day),
        );
        // …and the appended interest-only installment lands after everything.
        final appended = after.schedule[3];
        expect(appended.number, 4);
        expect(appended.amount, closeTo(share, 0.0001));
        // Born paid — the fee WAS the rollover payment, so it must not
        // re-appear as debt (mirrors the API's ledger rule).
        expect(appended.status, InstallmentStatus.paid);
        expect(appended.dueDate.isAfter(movedTo), isTrue);
      },
    );

    test('the appended fee is an extension, not an installment', () async {
      final before = await repo.getById('LN-2025-00841');
      final after = await repo.rollover('LN-2025-00841');

      final extensions = after.schedule.where((i) => i.rolloverFee).toList();
      final planned = after.schedule.where((i) => !i.rolloverFee).toList();

      expect(extensions, hasLength(after.rolloverCount));
      // The plan itself is untouched: 3 installments stay 3 installments,
      // and the detail screen renders the fee rows in their own section.
      expect(planned, hasLength(before.termInstallments));
      expect(before.schedule.every((i) => !i.rolloverFee), isTrue);
    });

    test(
      'conserves money: outstanding unchanged, Σ installments = totalDue',
      () async {
        final before = await repo.getById('LN-2025-00836'); // 1 of 2 paid
        final share =
            before.principal *
            before.interestRatePct /
            100 /
            before.termInstallments;

        final after = await repo.rollover('LN-2025-00836');

        expect(after.outstanding, closeTo(before.outstanding, 0.0001));
        expect(after.totalDue, closeTo(before.totalDue + share, 0.0001));
        expect(after.amountPaid, closeTo(before.amountPaid + share, 0.0001));
        final sum = after.schedule.fold<double>(0, (a, i) => a + i.amount);
        expect(sum, closeTo(after.totalDue, 0.0001));
        // Ledger invariant (the rule the API now enforces with a "born paid"
        // appended installment): the installments marked paid must sum to the
        // paid ledger. Booking the carry-over fee as COLLECTED and as an
        // unpaid installment at once is what left settled loans showing a pay
        // button — outstanding 0, yet an installment still due.
        final instPaid = after.schedule
            .where((i) => i.status == InstallmentStatus.paid)
            .fold<double>(0, (a, i) => a + i.amount);
        expect(instPaid, closeTo(after.amountPaid, 0.0001));
        // Dates stay strictly increasing after the shift + append.
        for (var i = 1; i < after.schedule.length; i++) {
          expect(
            after.schedule[i].dueDate.isAfter(after.schedule[i - 1].dueDate),
            isTrue,
            reason: 'installment ${after.schedule[i].number} is out of order',
          );
        }
      },
    );

    test('refuses to carry over a cleared loan', () async {
      await expectLater(repo.rollover('LN-2025-00690'), throwsStateError);
    });

    test('refuses an unknown loan id', () async {
      await expectLater(repo.rollover('LN-NOPE'), throwsStateError);
    });
  });
}
