import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';

abstract class LoanRequestsRepository {
  Future<List<LoanRequest>> loadByLender(String lenderId);
  Future<List<LoanRequest>> loadByClient(String clientId);
  Future<LoanRequest> getById(String id);

  /// Lenders the client can request from (linked via past lending).
  Future<List<({String id, String name})>> linkedLenders(String clientId);

  Future<LoanRequest> create({
    required String clientId,
    required String clientName,
    required String lenderId,
    required String lenderName,
    required double amount,
    required int termInstallments,
    required String purpose,
  });

  /// Maximum requestable amount for a client, derived from their risk
  /// profile. In the real system this is computed server-side from bureau
  /// scores + internal repayment history — the app only displays it.
  Future<double> creditLimit(String clientId);

  /// Approves the request and creates the actual loan.
  Future<Loan> approve(String requestId, {required double interestRatePct});

  Future<LoanRequest> reject(String requestId, {required String feedback});
}

/// In-memory mock — swap for API later; screens don't change.
class MockLoanRequestsRepository implements LoanRequestsRepository {
  final Map<String, LoanRequest> _db = {};
  var _seq = 1006;

  /// Mock identity lookup — the real API derives NRC from the JWT.
  static const _nrcByClient = {
    'clt_001': '245711/63/1',
    'clt_002': '318450/12/7',
    'clt_003': '556203/88/4',
    'clt_004': '102938/45/2',
    'clt_005': '774810/21/3',
    'clt_006': '660321/54/8',
    'clt_007': '445129/33/5',
  };

  MockLoanRequestsRepository() {
    for (final r in _seed()) {
      _db[r.id] = r;
    }
  }

  List<LoanRequest> _seed() => [
        LoanRequest(
          id: 'REQ-1002',
          clientId: 'clt_001',
          clientName: 'Mwansa Bwalya',
          nrc: '245711/63/1',
          phone: '0971112233',
          lenderId: 'biz_001',
          lenderName: 'Chilenje Community SACCO',
          amount: 4000,
          termInstallments: 3,
          purpose: 'Restock shop inventory ahead of the festive season',
          requestedAt: DateTime.now().subtract(const Duration(hours: 5)),
        ),
        LoanRequest(
          id: 'REQ-1005',
          clientId: 'clt_004',
          clientName: 'Grace Lungu',
          nrc: '102938/45/2',
          phone: '0972233445',
          lenderId: 'biz_001',
          lenderName: 'Chilenje Community SACCO',
          amount: 2000,
          termInstallments: 2,
          purpose: 'Emergency medical expenses for my mother',
          requestedAt: DateTime.now().subtract(const Duration(hours: 26)),
        ),
        LoanRequest(
          id: 'REQ-0998',
          clientId: 'clt_001',
          clientName: 'Mwansa Bwalya',
          nrc: '245711/63/1',
          phone: '0971112233',
          lenderId: 'biz_002',
          lenderName: 'Zamuka Savings & Credit',
          amount: 6000,
          termInstallments: 4,
          purpose: 'School fees for two children',
          requestedAt: DateTime.now().subtract(const Duration(days: 6)),
          status: LoanRequestStatus.rejected,
          feedback:
              'We can only lend up to K 5,000 to first-time borrowers. '
              'Reapply for a lower amount.',
          reviewedAt: DateTime.now().subtract(const Duration(days: 5)),
        ),
      ];

  @override
  Future<List<LoanRequest>> loadByLender(String lenderId) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    final list = _db.values.where((r) => r.lenderId == lenderId).toList();
    list.sort((a, b) {
      // pending first, then newest
      final p = a.status.index.compareTo(b.status.index);
      return p != 0 ? p : b.requestedAt.compareTo(a.requestedAt);
    });
    return list;
  }

  @override
  Future<List<LoanRequest>> loadByClient(String clientId) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final list = _db.values.where((r) => r.clientId == clientId).toList();
    list.sort((a, b) => b.requestedAt.compareTo(a.requestedAt));
    return list;
  }

  @override
  Future<LoanRequest> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    final r = _db[id];
    if (r == null) throw StateError('Request not found');
    return r;
  }

  @override
  Future<List<({String id, String name})>> linkedLenders(
      String clientId) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (clientId == 'clt_001') {
      return const [
        (id: 'biz_001', name: 'Chilenje Community SACCO'),
        (id: 'biz_002', name: 'Zamuka Savings & Credit'),
      ];
    }
    return const [(id: 'biz_001', name: 'Chilenje Community SACCO')];
  }

  @override
  Future<LoanRequest> create({
    required String clientId,
    required String clientName,
    required String lenderId,
    required String lenderName,
    required double amount,
    required int termInstallments,
    required String purpose,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    final request = LoanRequest(
      id: 'REQ-$_seq',
      clientId: clientId,
      clientName: clientName,
      nrc: _nrcByClient[clientId] ?? '—',
      phone: '—',
      lenderId: lenderId,
      lenderName: lenderName,
      amount: amount,
      termInstallments: termInstallments,
      purpose: purpose.trim(),
      requestedAt: DateTime.now(),
    );
    _db[request.id] = request;
    _seq++;
    return request;
  }

  @override
  Future<double> creditLimit(String clientId) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final loans = await mockLoansRepository.loansForClient(clientId);
    int? score;
    for (final l in loans) {
      final s = l.risk?.score;
      if (s != null && (score == null || s > score)) score = s;
    }
    return switch (score) {
      null => 1000, // no credit history yet
      >= 750 => 15000,
      >= 700 => 10000,
      >= 600 => 5000,
      >= 550 => 3000,
      _ => 1500,
    };
  }

  @override
  Future<Loan> approve(
    String requestId, {
    required double interestRatePct,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    final r = _db[requestId];
    if (r == null) throw StateError('Request not found');
    if (r.status != LoanRequestStatus.pending) {
      throw StateError('Request already reviewed');
    }
    final loan = await mockLoansRepository.createLoan(
      clientId: r.clientId,
      clientName: r.clientName,
      nrc: r.nrc,
      lenderName: r.lenderName,
      principal: r.amount,
      interestRatePct: interestRatePct,
      termInstallments: r.termInstallments,
    );
    _db[requestId] = LoanRequest(
      id: r.id,
      clientId: r.clientId,
      clientName: r.clientName,
      nrc: r.nrc,
      phone: r.phone,
      lenderId: r.lenderId,
      lenderName: r.lenderName,
      amount: r.amount,
      termInstallments: r.termInstallments,
      purpose: r.purpose,
      requestedAt: r.requestedAt,
      status: LoanRequestStatus.approved,
      reviewedAt: DateTime.now(),
    );
    return loan;
  }

  @override
  Future<LoanRequest> reject(
    String requestId, {
    required String feedback,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    final r = _db[requestId];
    if (r == null) throw StateError('Request not found');
    if (r.status != LoanRequestStatus.pending) {
      throw StateError('Request already reviewed');
    }
    final updated = LoanRequest(
      id: r.id,
      clientId: r.clientId,
      clientName: r.clientName,
      nrc: r.nrc,
      phone: r.phone,
      lenderId: r.lenderId,
      lenderName: r.lenderName,
      amount: r.amount,
      termInstallments: r.termInstallments,
      purpose: r.purpose,
      requestedAt: r.requestedAt,
      status: LoanRequestStatus.rejected,
      feedback: feedback.trim(),
      reviewedAt: DateTime.now(),
    );
    _db[requestId] = updated;
    return updated;
  }
}

// ---------- DI ----------

final mockLoanRequestsRepository = MockLoanRequestsRepository();

final loanRequestsRepositoryProvider = Provider<LoanRequestsRepository>(
  (ref) => mockLoanRequestsRepository,
);

final loanRequestsByLenderProvider =
    FutureProvider.autoDispose.family<List<LoanRequest>, String>(
  (ref, lenderId) =>
      ref.watch(loanRequestsRepositoryProvider).loadByLender(lenderId),
);

final loanRequestsByClientProvider =
    FutureProvider.autoDispose.family<List<LoanRequest>, String>(
  (ref, clientId) =>
      ref.watch(loanRequestsRepositoryProvider).loadByClient(clientId),
);

final creditLimitProvider = FutureProvider.autoDispose.family<double, String>(
  (ref, clientId) =>
      ref.watch(loanRequestsRepositoryProvider).creditLimit(clientId),
);

final loanRequestByIdProvider =
    FutureProvider.autoDispose.family<LoanRequest, String>(
  (ref, id) => ref.watch(loanRequestsRepositoryProvider).getById(id),
);

final linkedLendersProvider =
    FutureProvider.autoDispose
        .family<List<({String id, String name})>, String>(
  (ref, clientId) =>
      ref.watch(loanRequestsRepositoryProvider).linkedLenders(clientId),
);
