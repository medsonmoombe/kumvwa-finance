import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
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

  /// Credit allowance for one lender (M5 ladder). In the real system this is
  /// computed server-side from the tenant's published credit policy — the app
  /// only displays it. `lenderId` null falls back to the client's first linked
  /// lender.
  Future<CreditLimit> creditLimit(String clientId, {String? lenderId});

  /// The lender's first active product (rate/fee/max term) for the live apply
  /// breakdown. Null when the lender exposes no active product.
  Future<ProductTerms?> productTerms(String lenderId);

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
    String clientId,
  ) async {
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
      nrc: _nrcByClient[clientId] ?? '-',
      phone: '-',
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
  Future<CreditLimit> creditLimit(String clientId, {String? lenderId}) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final loans = await mockLoansRepository.loansForClient(clientId);
    int? score;
    for (final l in loans) {
      final s = l.risk?.score;
      if (s != null && (score == null || s > score)) score = s;
    }
    // Same ladder shape as the API (`resolveCreditLimit`): a kwacha limit
    // with a human tier label. Mock keeps the pre-M5 score bands for old
    // demo loans; the labels mirror the platform default ladder, and each
    // rung advertises the NEXT one the way the API's `nextTier` does.
    return switch (score) {
      null => const CreditLimit(
        limitKwacha: 1000,
        tier: 'First-time borrower',
        maxTermMonths: 1,
        nextTier: CreditNextTier(
          label: 'Building trust',
          limitKwacha: 2500,
          clearedNeeded: 1,
          clearedRemaining: 1,
        ),
      ),
      >= 750 => const CreditLimit(
        limitKwacha: 15000,
        tier: 'VIP',
        maxTermMonths: 12,
        nextTier: null, // top rung — nothing left to unlock
      ),
      >= 700 => const CreditLimit(
        limitKwacha: 10000,
        tier: 'Trusted client',
        maxTermMonths: 6,
        nextTier: CreditNextTier(
          label: 'VIP',
          limitKwacha: 15000,
          clearedNeeded: 7,
          clearedRemaining: 3,
        ),
      ),
      >= 600 => const CreditLimit(
        limitKwacha: 5000,
        tier: 'Proven borrower',
        maxTermMonths: 3,
        nextTier: CreditNextTier(
          label: 'Trusted client',
          limitKwacha: 10000,
          clearedNeeded: 4,
          clearedRemaining: 2,
        ),
      ),
      >= 550 => const CreditLimit(
        limitKwacha: 3000,
        tier: 'Building trust',
        maxTermMonths: 2,
        nextTier: CreditNextTier(
          label: 'Proven borrower',
          limitKwacha: 5000,
          clearedNeeded: 2,
          clearedRemaining: 1,
        ),
      ),
      _ => const CreditLimit(
        limitKwacha: 0,
        tier: 'blocked',
        maxTermMonths: 0,
        blockedReason: 'You have an overdue loan. Clear it to apply again',
      ),
    };
  }

  @override
  Future<ProductTerms?> productTerms(String lenderId) async {
    await Future<void>.delayed(const Duration(milliseconds: 250));
    // Mock lenders all advertise the same "Proven borrower" rate; real terms
    // come from the lender's first active product via public-info.
    return const ProductTerms(
      ratePct: 15,
      feePct: 0,
      maxTermMonths: 12,
      frequency: 'monthly',
      repaymentStructure: 'bullet',
    );
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
      loanId: loan.id,
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

// ---------- API-backed implementation ----------

/// Real loan requests. `/loan-requests` is client-scoped, `/loan-requests/
/// inbox` is lender-scoped; both resolve back to the same JSON item shape.
class ApiLoanRequestsRepository implements LoanRequestsRepository {
  ApiLoanRequestsRepository(this._client);

  static const _path = '/loan-requests';
  final ApiClient _client;

  @override
  Future<List<LoanRequest>> loadByLender(String lenderId) async {
    final res = await _client.getA('$_path/inbox');
    return _items(res.data);
  }

  @override
  Future<List<LoanRequest>> loadByClient(String clientId) async {
    final res = await _client.getA(_path);
    return _items(res.data);
  }

  @override
  Future<LoanRequest> getById(String id) async {
    final res = await _client.getA('$_path/$id');
    return _item(res.data as Map<String, dynamic>);
  }

  @override
  Future<List<({String id, String name})>> linkedLenders(
    String clientId,
  ) async {
    final res = await _client.getA('/clients/me/lenders');
    final raw = (res.data as Map<String, dynamic>)['items'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(
          (l) =>
              (id: l['id'] as String? ?? '', name: l['name'] as String? ?? ''),
        )
        .toList();
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
    final res = await _client.postA(
      _path,
      data: {
        'lenderId': lenderId,
        'amount': amount,
        'termCount': termInstallments,
        'purpose': purpose.trim(),
      },
    );
    final data = res.data as Map<String, dynamic>;
    return LoanRequest(
      id: data['id'] as String? ?? '',
      clientId: clientId,
      clientName: clientName,
      nrc: '',
      phone: '',
      lenderId: lenderId,
      lenderName: data['lenderName'] as String? ?? lenderName,
      amount: (data['amount'] as num?)?.toDouble() ?? amount,
      termInstallments:
          (data['termCount'] as num?)?.toInt() ?? termInstallments,
      purpose: purpose.trim(),
      requestedAt: DateTime.now(),
    );
  }

  @override
  Future<CreditLimit> creditLimit(String clientId, {String? lenderId}) async {
    // Server-computed from the tenant's published credit policy (M5) — the
    // banner can't disagree with a submit rejection. Scoped per lender.
    final res = await _client.getA(
      lenderId == null
          ? '/credit-limit'
          : '/credit-limit?lenderId=$lenderId',
    );
    final data = res.data as Map<String, dynamic>;
    final nextRaw = data['nextTier'] as Map<String, dynamic>?;
    return CreditLimit(
      limitKwacha: ((data['limitKwacha'] as num?) ?? 0).toDouble(),
      tier: data['tier'] as String? ?? '',
      maxTermMonths: (data['maxTermMonths'] as num?)?.toInt() ?? 12,
      blockedReason: data['blockedReason'] as String?,
      policyVersion: (data['policyVersion'] as num?)?.toInt() ?? 0,
      nextTier: nextRaw == null
          ? null
          : CreditNextTier(
              label: nextRaw['label'] as String? ?? '',
              limitKwacha: ((nextRaw['limitKwacha'] as num?) ?? 0).toDouble(),
              clearedNeeded: (nextRaw['clearedNeeded'] as num?)?.toInt() ?? 0,
              clearedRemaining:
                  (nextRaw['clearedRemaining'] as num?)?.toInt() ?? 0,
            ),
    );
  }

  @override
  Future<ProductTerms?> productTerms(String lenderId) async {
    // Public projection (no bearer needed) ships the lender's first active
    // product so the live breakdown shows the real rate before applying.
    final res = await _client.getPublic('/tenants/$lenderId/public-info');
    final data = res.data as Map<String, dynamic>;
    final p = data['product'] as Map<String, dynamic>?;
    if (p == null) return null;
    return ProductTerms(
      ratePct: ((p['ratePct'] as num?) ?? 0).toDouble(),
      feePct: ((p['feePct'] as num?) ?? 0).toDouble(),
      maxTermMonths: (p['maxTermMonths'] as num?)?.toInt() ?? 1,
      frequency: p['frequency'] as String? ?? 'monthly',
      repaymentStructure: p['repaymentStructure'] as String? ?? 'bullet',
    );
  }

  @override
  Future<Loan> approve(
    String requestId, {
    required double interestRatePct,
  }) async {
    final res = await _client.postA(
      '$_path/$requestId/approve',
      data: {'rateBps': (interestRatePct * 100).round()},
    );
    final data = res.data as Map<String, dynamic>;
    final loanId = data['loanId'] as String?;
    if (loanId == null) {
      throw const ApiException(
        'Loan was approved but no loan ID was returned.',
      );
    }
    // Approve is a lender-action; fetch the born loan as lender view.
    return ApiLoansRepository(_client, role: 'business').getById(loanId);
  }

  @override
  Future<LoanRequest> reject(
    String requestId, {
    required String feedback,
  }) async {
    await _client.postA(
      '$_path/$requestId/reject',
      data: {'feedback': feedback.trim()},
    );
    return getById(requestId);
  }

  List<LoanRequest> _items(dynamic data) {
    final raw = (data as Map<String, dynamic>)['items'];
    if (raw is! List) return const [];
    return raw.whereType<Map<String, dynamic>>().map(_item).toList();
  }

  LoanRequest _item(Map<String, dynamic> item) => LoanRequest(
    id: item['id'] as String? ?? '',
    clientId: item['clientId'] as String? ?? '',
    clientName: item['clientName'] as String? ?? '',
    nrc: '',
    phone: item['phone'] as String? ?? '',
    lenderId: item['lenderId'] as String? ?? '',
    lenderName: item['lenderName'] as String? ?? '',
    amount: (item['amount'] as num?)?.toDouble() ?? 0,
    termInstallments: (item['termCount'] as num?)?.toInt() ?? 0,
    purpose: item['purpose'] as String? ?? '',
    requestedAt: isoDate(item['requestedAt']) ?? DateTime.now(),
    status: toLoanRequestStatus(item['status'] as String?),
    feedback: item['feedback'] as String?,
    reviewedAt: isoDate(item['reviewedAt']),
    loanId: item['loanId'] as String?,
  );
}

// ---------- DI ----------

final mockLoanRequestsRepository = MockLoanRequestsRepository();

final loanRequestsRepositoryProvider = Provider<LoanRequestsRepository>(
  (ref) => Env.useMocks
      ? mockLoanRequestsRepository
      : ApiLoanRequestsRepository(ref.watch(apiClientProvider)),
);

final loanRequestsByLenderProvider = FutureProvider.autoDispose
    .family<List<LoanRequest>, String>(
      (ref, lenderId) =>
          ref.watch(loanRequestsRepositoryProvider).loadByLender(lenderId),
    );

final loanRequestsByClientProvider = FutureProvider.autoDispose
    .family<List<LoanRequest>, String>(
      (ref, clientId) =>
          ref.watch(loanRequestsRepositoryProvider).loadByClient(clientId),
    );

final creditLimitProvider =
    FutureProvider.autoDispose.family<CreditLimit, ({String clientId, String? lenderId})>(
  (ref, key) => ref
      .watch(loanRequestsRepositoryProvider)
      .creditLimit(key.clientId, lenderId: key.lenderId),
);

final loanRequestByIdProvider = FutureProvider.autoDispose
    .family<LoanRequest, String>(
      (ref, id) => ref.watch(loanRequestsRepositoryProvider).getById(id),
    );

final linkedLendersProvider = FutureProvider.autoDispose
    .family<List<({String id, String name})>, String>(
      (ref, clientId) =>
          ref.watch(loanRequestsRepositoryProvider).linkedLenders(clientId),
    );
