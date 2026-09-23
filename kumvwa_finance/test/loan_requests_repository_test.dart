import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';

void main() {
  // The requests repo calls mockLoansRepository.createLoan on approve, so
  // tests share the global store — a fresh requests repo per test is enough
  // because approvals land in the loans store keyed by new unique ids.
  late ProviderContainer container;
  late MockLoanRequestsRepository repo;

  setUp(() {
    repo = MockLoanRequestsRepository();
    // The default provider now points at the live API; route the provider
    // tests through the mock to keep them hermetic.
    container = ProviderContainer(
      overrides: [
        loanRequestsRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);
  });

  group('seed data', () {
    test('loads two pending and one rejected request for biz_001',
        () async {
      final requests = await repo.loadByLender('biz_001');

      expect(requests, hasLength(2));
      expect(
        requests.every((r) => r.status == LoanRequestStatus.pending),
        isTrue,
      );
      // Pending sorts before anything else, then newest first.
      expect(requests.map((r) => r.id), ['REQ-1002', 'REQ-1005']);
    });

    test('the rejected seed goes to its lender, not biz_001', () async {
      final zamuka = await repo.loadByLender('biz_002');

      expect(zamuka, hasLength(1));
      expect(zamuka.single.id, 'REQ-0998');
      expect(zamuka.single.status, LoanRequestStatus.rejected);
      expect(zamuka.single.feedback, isNotNull);
    });

    test('loadByClient returns the client requests newest first', () async {
      final mine = await repo.loadByClient('clt_001');

      expect(mine.map((r) => r.id).toSet(), {'REQ-1002', 'REQ-0998'});
      expect(
        mine.first.requestedAt
            .isAfter(mine.last.requestedAt),
        isTrue,
      );
    });

    test('getById throws for an unknown id', () async {
      await expectLater(repo.getById('REQ-NOPE'), throwsStateError);
    });

    test('linkedLenders gives the demo client both lenders', () async {
      final lenders = await repo.linkedLenders('clt_001');

      expect(lenders.map((l) => l.id), ['biz_001', 'biz_002']);
    });

    test('other clients only see the SACCO', () async {
      final lenders = await repo.linkedLenders('clt_004');

      expect(lenders, hasLength(1));
      expect(lenders.single.name, 'Chilenje Community SACCO');
    });
  });

  group('create', () {
    test('stores a pending request with a sequential id', () async {
      final request = await repo.create(
        clientId: 'clt_001',
        clientName: 'Mwansa Bwalya',
        lenderId: 'biz_001',
        lenderName: 'Chilenje Community SACCO',
        amount: 1500,
        termInstallments: 2,
        purpose: '  Restock kitchenware stock  ',
      );

      expect(request.id, 'REQ-1006'); // first past the seed counter
      expect(request.status, LoanRequestStatus.pending);
      expect(request.amount, 1500);
      expect(request.purpose, 'Restock kitchenware stock'); // trimmed
      expect(request.nrc, '245711/63/1'); // mock identity lookup

      final stored = await repo.getById('REQ-1006');
      expect(stored.id, request.id);
    });
  });

  group('approve', () {
    test('creates a real active loan and marks the request approved',
        () async {
      final loan = await repo.approve('REQ-1002', interestRatePct: 15);

      expect(loan.status, LoanStatus.active);
      expect(loan.clientId, 'clt_001');
      expect(loan.lenderName, 'Chilenje Community SACCO');
      expect(loan.principal, 4000);
      expect(loan.interestRatePct, 15);
      // First installment lands next month — nothing is overdue yet.
      expect(loan.amountPaid, 0);

      final request = await repo.getById('REQ-1002');
      expect(request.status, LoanRequestStatus.approved);
      expect(request.reviewedAt, isNotNull);
    });

    test('the created loan is visible through the loans repository',
        () async {
      final loan = await repo.approve('REQ-1002', interestRatePct: 12);
      final fromLoans = await mockLoansRepository.getById(loan.id);

      expect(fromLoans.id, loan.id);
      expect(fromLoans.schedule, hasLength(3)); // REQ-1002 term
    });

    test('rejects a second review of the same request', () async {
      await repo.approve('REQ-1002', interestRatePct: 15);

      await expectLater(
        repo.approve('REQ-1002', interestRatePct: 15),
        throwsStateError,
      );
    });
  });

  group('reject', () {
    test('stores trimmed feedback and a review timestamp', () async {
      final updated = await repo.reject(
        'REQ-1005',
        feedback: '  Below minimum loan size for now.  ',
      );

      expect(updated.status, LoanRequestStatus.rejected);
      expect(updated.feedback, 'Below minimum loan size for now.');
      expect(updated.reviewedAt, isNotNull);
    });

    test('rejects a second review of the same request', () async {
      await repo.reject('REQ-1005', feedback: 'Not at this time.');

      await expectLater(
        repo.reject('REQ-1005', feedback: 'Again?'),
        throwsStateError,
      );
    });

    test('an approved request can no longer be rejected', () async {
      await repo.approve('REQ-1002', interestRatePct: 15);

      await expectLater(
        repo.reject('REQ-1002', feedback: 'Changed my mind'),
        throwsStateError,
      );
    });
  });

  group('providers', () {
    test('loanRequestsByLenderProvider resolves', () async {
      final requests = await container.read(
        loanRequestsByLenderProvider('biz_001').future,
      );

      expect(requests, isNotEmpty);
    });

    test('loanRequestsByClientProvider resolves', () async {
      final requests = await container.read(
        loanRequestsByClientProvider('clt_001').future,
      );

      expect(requests, isNotEmpty);
    });

    test('linkedLendersProvider resolves for the demo client', () async {
      final lenders = await container.read(
        linkedLendersProvider('clt_001').future,
      );

      expect(lenders, hasLength(2));
    });
  });
}
