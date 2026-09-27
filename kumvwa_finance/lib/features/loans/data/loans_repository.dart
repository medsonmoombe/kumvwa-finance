import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
import 'package:kumvwa_finance/core/time/zambia_time.dart';
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

  /// Records a repayment of [amount] kwacha against the loan and returns
  /// the updated loan. The caller (pay sheet) always knows the exact figure
  /// — the next installment — so it passes it rather than being re-derived.
  Future<Loan> recordPayment(String loanId, {required double amount});

  /// "Pay interest & extend": pays one month's interest share server-side,
  /// shifts every unpaid due date +1 month and appends an interest-only
  /// installment. Capped by the API's ROLLOVER_MAX.
  Future<Loan> rollover(String loanId);
}

/// Global mock singleton — payments mutate THIS instance, so every provider
/// sees the same state. (A provider-created instance would be fine too, but
/// the pay sheet calls the repository directly and must hit the same store.)
final MockLoansRepository mockLoansRepository = MockLoansRepository();

/// Mock data with realistic latency so skeletons are visible in dev.
/// Swap for the API-backed implementation when the backend lands.
class MockLoansRepository implements LoansRepository {
  /// Mirror of the API's `ROLLOVER_MAX` (apps/api config, default 2).
  static const maxRollovers = 2;

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
    String repaymentStructure = 'installments',
  }) {
    final today = zambiaToday();
    final total = principal * (1 + ratePct / 100);
    final per = total / term;

    // Mock loans follow the same rule as the API: a term of N months matures
    // N calendar months after drawdown, counted from the day the money was
    // released (today, less startMonthsAgo) — never on a fixed day of month.
    final drawnDown = DateTime(
      today.year,
      today.month - startMonthsAgo,
      today.day,
    );

    final List<Installment> schedule;
    if (repaymentStructure == 'bullet') {
      // M5: ONE lump for the whole obligation at maturity.
      final due = addMonthsClamped(drawnDown, term);
      schedule = [
        Installment(
          number: 1,
          dueDate: due,
          amount: total,
          status: due.isBefore(today)
              ? InstallmentStatus.overdue
              : InstallmentStatus.upcoming,
        ),
      ];
    } else {
      schedule = List.generate(term, (i) {
        // First payment one month after drawdown, then monthly.
        final due = addMonthsClamped(drawnDown, i + 1);
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
    }

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
      loanRef: id,
      repaymentStructure: repaymentStructure,
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
           // Drawn 3 months ago on a 2-month term: the second payment fell due
           // last month, so the loan is genuinely behind.
           startMonthsAgo: 3,
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
      // New loans are born as bullet lumps (M5 platform default), just like
      // the API (products default to 'bullet').
      repaymentStructure: 'bullet',
    );
    _db[loan.id] = loan;
    return loan;
  }

  @override
  Future<Loan> recordPayment(String loanId, {required double amount}) async {
    await Future<void>.delayed(const Duration(milliseconds: 1300));
    final loan = _db[loanId];
    if (loan == null) throw StateError('Loan not found');
    final next = loan.nextInstallment;
    if (next == null) throw StateError('Loan already cleared');
    // The mock settles the next installment regardless of the amount passed
    // — mock schedules have fixed per-installment figures.

    final schedule = loan.schedule
        .map(
          (i) => i.number == next.number
              ? Installment(
                  number: i.number,
                  dueDate: i.dueDate,
                  amount: i.amount,
                  penalty: i.penalty,
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
      tenantId: loan.tenantId,
      frequency: loan.frequency,
      rolloverCount: loan.rolloverCount,
      risk: loan.risk,
      loanRef: loan.loanRef,
      repaymentStructure: loan.repaymentStructure,
    );
    _db[loanId] = updated;
    return updated;
  }

  /// Mirrors the server contract (core's `rolloverPlan`): the borrower pays one
  /// installment's interest share now, every UNPAID due date moves +1 month, and
  /// an interest-only installment is appended at the end. Outstanding is
  /// unchanged — `amountPaid` and `totalDue` both grow by the share, so
  /// Σ installments still equals `totalDue`. The API stays authoritative in live
  /// mode (it also enforces `ROLLOVER_MAX` and records the repayment row).
  @override
  Future<Loan> rollover(String loanId) async {
    await Future<void>.delayed(const Duration(milliseconds: 1300));
    final loan = _db[loanId];
    if (loan == null) throw StateError('Loan not found');
    if (loan.nextInstallment == null) throw StateError('Loan already cleared');
    // Same cap as the API (`ROLLOVER_MAX`): extensions are counted per loan
    // and a payment does not reset the count. Without this the demo could
    // extend forever, which is not how the service behaves.
    if (loan.rolloverCount >= maxRollovers) {
      throw StateError('Rollover limit reached');
    }

    final share =
        loan.principal * loan.interestRatePct / 100 / loan.termInstallments;
    if (share <= 0) throw StateError('Nothing to carry');

    // Bullet parity with the API (`rolloverBulletPlan`): pay the month's
    // interest share, maturity moves +1 month, the SINGLE lump grows by the
    // share. outstanding stays unchanged (amountPaid grows too).
    if (loan.repaymentStructure == 'bullet') {
      final inst = loan.schedule.single;
      if (inst.status == InstallmentStatus.paid) {
        throw StateError('Loan already cleared');
      }
      final newInst = Installment(
        number: inst.number,
        dueDate: addMonthsClamped(inst.dueDate, 1),
        amount: inst.amount + share,
        penalty: inst.penalty,
        status: inst.status,
      );
      final paid = loan.amountPaid + share;
      final total = loan.totalDue + share;
      final updated = Loan(
        id: loan.id,
        clientId: loan.clientId,
        clientName: loan.clientName,
        lenderName: loan.lenderName,
        nrc: loan.nrc,
        principal: loan.principal,
        interestRatePct: loan.interestRatePct,
        termInstallments: loan.termInstallments,
        totalDue: total,
        amountPaid: paid,
        status: paid >= total ? LoanStatus.cleared : loan.status,
        schedule: [newInst],
        tenantId: loan.tenantId,
        frequency: loan.frequency,
        rolloverCount: loan.rolloverCount + 1,
        risk: loan.risk,
        loanRef: loan.loanRef,
        repaymentStructure: loan.repaymentStructure,
      );
      _db[loanId] = updated;
      return updated;
    }

    final unpaidNumbers = loan.schedule
        .where((i) => i.status != InstallmentStatus.paid)
        .map((i) => i.number)
        .toSet();
    final lastSeq = loan.schedule
        .map((i) => i.number)
        .reduce((a, b) => a > b ? a : b);

    // Only unpaid installments move; settled history keeps its dates.
    final schedule = loan.schedule
        .map(
          (i) => unpaidNumbers.contains(i.number)
              ? Installment(
                  number: i.number,
                  dueDate: addMonthsClamped(i.dueDate, 1),
                  amount: i.amount,
                  penalty: i.penalty,
                  status: i.status,
                )
              : i,
        )
        .toList();

    // Anchor the appended installment a month past the latest SHIFTED date so
    // the schedule stays strictly increasing (same rule as core/rollover.ts).
    final lastShifted = schedule
        .map((i) => i.dueDate)
        .reduce((a, b) => a.isAfter(b) ? a : b);
    // Born PAID, mirroring the API: this row records the interest charge the
    // rollover just collected (amountPaid grows by the same share below).
    // Appending it unpaid would leave phantom debt on an otherwise settled
    // loan — outstanding 0, yet an installment showing as due.
    schedule.add(
      Installment(
        number: lastSeq + 1,
        dueDate: addMonthsClamped(lastShifted, 1),
        amount: share,
        status: InstallmentStatus.paid,
        // Beyond the original term => an extension fee, not an installment,
        // so the detail screen shows it under Extensions (mirrors the API).
        rolloverFee: true,
      ),
    );

    final paid = loan.amountPaid + share;
    final total = loan.totalDue + share;
    final updated = Loan(
      id: loan.id,
      clientId: loan.clientId,
      clientName: loan.clientName,
      lenderName: loan.lenderName,
      nrc: loan.nrc,
      principal: loan.principal,
      interestRatePct: loan.interestRatePct,
      termInstallments: loan.termInstallments,
      totalDue: total,
      amountPaid: paid,
      status: paid >= total ? LoanStatus.cleared : loan.status,
      schedule: schedule,
      tenantId: loan.tenantId,
      frequency: loan.frequency,
      rolloverCount: loan.rolloverCount + 1,
      risk: loan.risk,
      loanRef: loan.loanRef,
      repaymentStructure: loan.repaymentStructure,
    );
    _db[loanId] = updated;
    return updated;
  }
}

/// Month arithmetic that never rolls over (31 Jan + 1mo → 28 Feb), matching
/// `addMonthsUtc` in @kumvwa/core.
DateTime addMonthsClamped(DateTime date, int months) {
  final targetMonth = date.month + months;
  final lastDay = DateTime(date.year, targetMonth + 1, 0).day;
  return DateTime(
    date.year,
    targetMonth,
    date.day <= lastDay ? date.day : lastDay,
  );
}

// ---------- API-backed implementation ----------

/// Real loans. Client sessions hit `/my/loans` (cross-lender view); lender
/// sessions hit `/loans` + `/loans/:id`. List items have no schedule, so the
/// summary cards render from outstandings while the detail screen does a
/// per-loan fetch that carries the full installment schedule.
class ApiLoansRepository implements LoansRepository {
  ApiLoansRepository(this._client, {required this.role, this.clientId});

  final ApiClient _client;
  final String? role;
  final String? clientId;

  bool get _isClient => role == 'client';

  @override
  Future<List<Loan>> load() async {
    if (_isClient) {
      final res = await _client.getA('/my/loans');
      final items =
          (res.data as Map<String, dynamic>)['items'] as List<dynamic>? ??
          const [];
      return items.whereType<Map<String, dynamic>>().map(_myLoan).toList();
    }

    // Lender view: `/loans` items don't carry clientId, but `/clients`
    // gives us phone → id, and loan items expose clientPhone.
    final results = await Future.wait([
      _client.getA('/loans'),
      _client.getA('/clients'),
    ]);
    final items =
        (results[0].data as Map<String, dynamic>)['items'] as List<dynamic>? ??
        const [];
    final clientById = <String, String>{};
    final clients =
        (results[1].data as Map<String, dynamic>)['items'] as List<dynamic>? ??
        const [];
    for (final c in clients.whereType<Map<String, dynamic>>()) {
      final phone = c['phone'] as String?;
      final id = c['id'] as String?;
      if (phone != null && id != null) clientById[phone] = id;
    }

    return items
        .whereType<Map<String, dynamic>>()
        .map((item) => _listLoan(item, clientById))
        .toList();
  }

  @override
  Future<Loan> getById(String id) async {
    if (_isClient) {
      final all = await loansForClient(clientId ?? '');
      return all.firstWhere(
        (l) => l.id == id,
        orElse: () => throw StateError('Loan not found'),
      );
    }

    final res = await _client.getA('/loans/$id');
    return _detailLoan(res.data as Map<String, dynamic>);
  }

  @override
  Future<List<Loan>> loansForClient(String clientId) async {
    if (!_isClient) return load();
    final res = await _client.getA('/my/loans');
    final items =
        (res.data as Map<String, dynamic>)['items'] as List<dynamic>? ??
        const [];
    final loans = items.whereType<Map<String, dynamic>>().map(_myLoan).toList();
    return loans
        .where((l) => clientId.isEmpty || l.clientId == clientId)
        .toList();
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
    // Real loans are born from an approved loan request
    // (POST /loan-requests/:id/approve) — there is no bare loan POST.
    throw const ApiException('Loans are created by approving a loan request.');
  }

  @override
  Future<Loan> recordPayment(String loanId, {required double amount}) async {
    final loan = await getById(loanId);
    if (loan.nextInstallment == null) {
      throw const ApiException('Loan already fully repaid');
    }
    // Idempotency-Key makes a retried POST safe (no double-crediting) —
    // the API replays the original repayment instead.
    try {
      await _client.postA(
        '/loans/$loanId/repayments',
        data: {'amount': amount, 'method': 'in_app'},
        headers: {'Idempotency-Key': const Uuid().v4()},
      );
    } on DioException catch (e) {
      // Wrap like rollover() does: callers then show the server's own message
      // ('Insufficient role') rather than DioException's multi-line dump.
      throw ApiException.fromDio(e);
    }
    return getById(loanId);
  }

  @override
  Future<Loan> rollover(String loanId) async {
    try {
      await _client.postA(
        '/loans/$loanId/rollover',
        headers: {'Idempotency-Key': const Uuid().v4()},
      );
      return getById(loanId);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  // ---- mappers ----

  Loan _myLoan(Map<String, dynamic> item) => Loan(
    id: item['id'] as String? ?? '',
    loanRef: item['loanRef'] as String?,
    repaymentStructure:
        item['repaymentStructure'] as String? ?? 'bullet',
    clientId: clientId ?? '',
    clientName: '',
    lenderName: item['lenderName'] as String? ?? '',
    nrc: '',
    principal: _num(item['principal']),
    interestRatePct: _bps(item['rateBps']),
    termInstallments: _int(item['termCount']),
    totalDue: _num(item['totalDue']),
    amountPaid: _num(item['paid']),
    status: toLoanStatus(item['status'] as String?),
    tenantId: item['tenantId'] as String?,
    frequency: item['frequency'] as String? ?? 'monthly',
    rolloverCount: _int(item['rolloverCount']),
    schedule: _installments(item['installments']),
  );

  Loan _listLoan(Map<String, dynamic> item, Map<String, String> clientById) =>
      Loan(
        id: item['id'] as String? ?? '',
        loanRef: item['loanRef'] as String?,
        repaymentStructure:
            item['repaymentStructure'] as String? ?? 'bullet',
        clientId: clientById[item['clientPhone'] as String?] ?? '',
        clientName: item['clientName'] as String? ?? '',
        lenderName: '',
        nrc: '',
        principal: _num(item['principal']),
        interestRatePct: _bps(item['rateBps']),
        termInstallments: _int(item['termCount']),
        totalDue: _num(item['totalDue']),
        amountPaid: _num(item['paidAmount']),
        status: toLoanStatus(item['status'] as String?),
        schedule: const [],
      );

  Loan _detailLoan(Map<String, dynamic> item) => Loan(
    id: item['id'] as String? ?? '',
    loanRef: item['loanRef'] as String?,
    repaymentStructure:
        item['repaymentStructure'] as String? ?? 'bullet',
    clientId: item['clientId'] as String? ?? '',
    clientName: item['clientName'] as String? ?? '',
    lenderName: '',
    nrc: '',
    principal: _num(item['principal']),
    interestRatePct: _bps(item['rateBps']),
    termInstallments: _int(item['termCount']),
    totalDue: _num(item['totalDue']),
    amountPaid: _num(item['paidAmount']),
    status: toLoanStatus(item['status'] as String?),
    frequency: item['frequency'] as String? ?? 'monthly',
    rolloverCount: _int(item['rolloverCount']),
    schedule: _installments(item['schedule']),
  );

  List<Installment> _installments(dynamic raw) {
    if (raw is! List) return const [];
    return raw.whereType<Map<String, dynamic>>().map((i) {
      final dueDate = isoDate(i['dueDate']);
      return Installment(
        number: _int(i['seq']),
        dueDate: dueDate ?? DateTime.now(),
        amount: _num(i['amount']) != 0
            ? _num(i['amount'])
            : minorToKwacha(i['amountMinor']),
        penalty: minorToKwacha(i['penaltyMinor']),
        status: toInstallmentStatus(i['status'] as String?, dueDate),
        rolloverFee: i['rolloverFee'] as bool? ?? false,
      );
    }).toList();
  }

  static double _num(dynamic value) => value is num ? value.toDouble() : 0;
  static int _int(dynamic value) => value is num ? value.toInt() : 0;
  static double _bps(dynamic value) =>
      value is num ? value.toDouble() / 100 : 0;
}

// ---------- DI ----------

final loansRepositoryProvider = Provider<LoansRepository>((ref) {
  if (Env.useMocks) return mockLoansRepository;
  final session = ref.watch(authControllerProvider).session;
  return ApiLoansRepository(
    ref.watch(apiClientProvider),
    role: session?.role,
    clientId: session?.userId,
  );
});

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
    ..sort((a, b) => (a.daysUntilDue ?? 999).compareTo(b.daysUntilDue ?? 999));
});
