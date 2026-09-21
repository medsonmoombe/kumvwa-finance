import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';

abstract class LoansRepository {
  Future<List<Loan>> load();
  Future<Loan> getById(String id);
  Future<List<Loan>> loansForClient(String clientId);

  /// Creates a real loan — used when a lender approves a request.
  Future<Loan> createLoan({
    required String clientId,
    required String clientName,
    required String nrc,
    required String lenderName,
    required double principal,
    required double interestRatePct,
    required int termInstallments,
  });
}

/// Global mock singleton — payments mutate THIS instance, so every provider
/// sees the same state. (A provider-created instance would be fine too, but
/// the pay sheet calls the repository directly and must hit the same store.)
final MockLoansRepository mockLoansRepository = MockLoansRepository();

/// Mock data with realistic latency so skeletons are visible in dev.
/// Swap for the API-backed implementation when the backend lands.
class MockLoansRepository implements LoansRepository {
  final Map<String, Loan> _db = {};
  var _loanSeq = 900;

  MockLoansRepository() {
    for (final loan in _seed()) {
      _db[loan.id] = loan;
    }
  }

  Loan _loan({
    required String id,
    required String clientId,
    required String clientName,
    required String lenderName,
    required String nrc,
    required double principal,
    required double ratePct,
    required int term,
    required int paidCount,
    required LoanStatus status,
    required int startMonthsAgo,
    CreditRisk? risk,
  }) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final total = principal * (1 + ratePct / 100);
    final per = total / term;

    final schedule = List.generate(term, (i) {
      final due = DateTime(now.year, now.month - startMonthsAgo + i, 12);
      final InstallmentStatus st;
      if (i < paidCount) {
        st = InstallmentStatus.paid;
      } else if (due.isBefore(today)) {
        st = InstallmentStatus.overdue;
      } else if (i == paidCount) {
        st = InstallmentStatus.due;
      } else {
        st = InstallmentStatus.upcoming;
      }
      final amount = i == term - 1 ? total - per * (term - 1) : per;
      return Installment(
        number: i + 1,
        dueDate: due,
        amount: amount,
        status: st,
      );
    });

    return Loan(
      id: id,
      clientId: clientId,
      clientName: clientName,
      lenderName: lenderName,
      nrc: nrc,
      principal: principal,
      interestRatePct: ratePct,
      termInstallments: term,
      totalDue: total,
      amountPaid: per * paidCount,
      status: status,
      schedule: schedule,
      risk: risk,
    );
  }

  List<Loan> _seed() {
    const sacco = 'Chilenje Community SACCO';
    return [
      _loan(
        id: 'LN-2025-00841',
        clientId: 'clt_001',
        clientName: 'Mwansa Bwalya',
        nrc: '245711/63/1',
        principal: 8500,
        ratePct: 15,
        term: 3,
        paidCount: 2,
        status: LoanStatus.active,
        startMonthsAgo: 2,
        lenderName: sacco,
        risk: CreditRisk(
          score: 742,
          source: 'TransUnion Zambia',
          checkedAt: DateTime(2025, 8, 2),
        ),
      ),
      // Second loan for Mwansa from ANOTHER lender — demonstrates the
      // multi-lender client view on the client home screen.
      _loan(
        id: 'LN-2025-00210',
        clientId: 'clt_001',
        clientName: 'Mwansa Bwalya',
        nrc: '245711/63/1',
        principal: 2500,
        ratePct: 14,
        term: 2,
        paidCount: 0,
        status: LoanStatus.active,
        startMonthsAgo: 0,
        lenderName: 'Zamuka Savings & Credit',
        risk: null,
      ),
      _loan(
        id: 'LN-2025-00836',
        clientId: 'clt_002',
        clientName: 'Chanda Nkhoma',
        nrc: '318450/12/7',
        principal: 3200,
        ratePct: 12,
        term: 2,
        paidCount: 1,
        status: LoanStatus.overdue,
        startMonthsAgo: 2,
        lenderName: sacco,
        risk: CreditRisk(
          score: 610,
          source: 'TransUnion Zambia',
          checkedAt: DateTime(2025, 7, 20),
        ),
      ),
      _loan(
        id: 'LN-2025-00847',
        clientId: 'clt_004',
        clientName: 'Grace Lungu',
        nrc: '102938/45/2',
        principal: 5100,
        ratePct: 10,
        term: 2,
        paidCount: 1,
        status: LoanStatus.active,
        startMonthsAgo: 1,
        lenderName: sacco,
        risk: CreditRisk(
          score: 788,
          source: 'Experian Zambia',
          checkedAt: DateTime(2025, 7, 18),
        ),
      ),
      _loan(
        id: 'LN-2025-00780',
        clientId: 'clt_003',
        clientName: 'Mutale Phiri',
        nrc: '556203/88/4',
        principal: 4200,
        ratePct: 18,
        term: 3,
        paidCount: 1,
        status: LoanStatus.overdue,
        startMonthsAgo: 4,
        lenderName: sacco,
        risk: CreditRisk(
          score: 480,
          source: 'TransUnion Zambia',
          checkedAt: DateTime(2025, 6, 30),
        ),
      ),
      _loan(
        id: 'LN-2025-00860',
        clientId: 'clt_005',
        clientName: 'Bupe Chilufya',
        nrc: '774810/21/3',
        principal: 1200,
        ratePct: 15,
        term: 1,
        paidCount: 0,
        status: LoanStatus.active,
        startMonthsAgo: 0,
        lenderName: sacco,
        risk: null, // no credit check yet
      ),
      _loan(
        id: 'LN-2025-00755',
        clientId: 'clt_007',
        clientName: 'Joseph Sampa',
        nrc: '445129/33/5',
        principal: 6100,
        ratePct: 20,
        term: 2,
        paidCount: 1,
        status: LoanStatus.overdue,
        startMonthsAgo: 3,
        lenderName: sacco,
        risk: CreditRisk(
          score: 520,
          source: 'TransUnion Zambia',
          checkedAt: DateTime(2025, 6, 12),
        ),
      ),
      _loan(
        id: 'LN-2025-00690',
        clientId: 'clt_006',
        clientName: 'Tamara Mvula',
        nrc: '660321/54/8',
        principal: 4000,
        ratePct: 12,
        term: 2,
        paidCount: 2,
        status: LoanStatus.cleared,
        startMonthsAgo: 6,
        lenderName: sacco,
        risk: CreditRisk(
          score: 690,
          source: 'TransUnion Zambia',
          checkedAt: DateTime(2025, 2, 8),
        ),
      ),
    ];
  }

  @override
  Future<List<Loan>> load() async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    return _db.values.toList();
  }

  @override
  Future<Loan> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 350));
    final loan = _db[id];
    if (loan == null) throw StateError('Loan not found');
    return loan;
  }

  @override
  Future<List<Loan>> loansForClient(String clientId) async {
    return _db.values.where((l) => l.clientId == clientId).toList();
  }

  @override
  Future<Loan> createLoan({
    required String clientId,
    required String clientName,
    required String nrc,
    required String lenderName,
    required double principal,
    required double interestRatePct,
    required int termInstallments,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final loan = _loan(
      id: 'LN-2025-00${_loanSeq++}',
      clientId: clientId,
      clientName: clientName,
      nrc: nrc,
      principal: principal,
      ratePct: interestRatePct,
      term: termInstallments,
      paidCount: 0,
      status: LoanStatus.active,
      startMonthsAgo: -1, // first installment due next month
      lenderName: lenderName,
      risk: null,
    );
    _db[loan.id] = loan;
    return loan;
  }

  /// Simulated repayment: settles the next unpaid installment.
  /// Paying before its due date = paying in advance (same code path).
  /// Real mobile-money flow lands with the backend.
  Future<Loan> recordPayment(String loanId) async {
    await Future<void>.delayed(const Duration(milliseconds: 1300));
    final loan = _db[loanId];
    if (loan == null) throw StateError('Loan not found');
    final next = loan.nextInstallment;
    if (next == null) throw StateError('Loan already cleared');

    final schedule = loan.schedule
        .map(
          (i) => i.number == next.number
              ? Installment(
                  number: i.number,
                  dueDate: i.dueDate,
                  amount: i.amount,
                  status: InstallmentStatus.paid,
                )
              : i,
        )
        .toList();
    final paid = loan.amountPaid + next.amount;
    final cleared = schedule.every((i) => i.status == InstallmentStatus.paid);

    final updated = Loan(
      id: loan.id,
      clientId: loan.clientId,
      clientName: loan.clientName,
      lenderName: loan.lenderName,
      nrc: loan.nrc,
      principal: loan.principal,
      interestRatePct: loan.interestRatePct,
      termInstallments: loan.termInstallments,
      totalDue: loan.totalDue,
      amountPaid: paid,
      status: cleared ? LoanStatus.cleared : loan.status,
      schedule: schedule,
      risk: loan.risk,
    );
    _db[loanId] = updated;
    return updated;
  }
}

// ---------- DI ----------

final loansRepositoryProvider = Provider<LoansRepository>(
  (ref) => mockLoansRepository,
);

final loansProvider = FutureProvider<List<Loan>>(
  (ref) => ref.watch(loansRepositoryProvider).load(),
);

final loanByIdProvider = FutureProvider.autoDispose.family<Loan, String>(
  (ref, id) => ref.watch(loansRepositoryProvider).getById(id),
);

/// Loans belonging to the logged-in CLIENT (multi-lender view),
/// sorted soonest-due first.
final clientLoansProvider = FutureProvider<List<Loan>>((ref) async {
  final session = ref.watch(authControllerProvider).session;
  final loans = await ref.watch(loansRepositoryProvider).load();
  return loans.where((l) => l.clientId == session?.userId).toList()
    ..sort(
      (a, b) => (a.daysUntilDue ?? 999).compareTo(b.daysUntilDue ?? 999),
    );
});
