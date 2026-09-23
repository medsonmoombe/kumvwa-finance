import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
import 'package:kumvwa_finance/features/clients/domain/client.dart';
import 'package:kumvwa_finance/features/profile/domain/client_profile.dart';

abstract class ClientsRepository {
  Future<List<Client>> load();
  Future<Client> getById(String id);

  /// Client self-service: the borrower's own profile + KYC completeness.
  Future<ClientProfile> getMe();

  /// Post-login KYC wizard target. Returns the refreshed profile.
  Future<ClientProfile> updateProfile({
    String? nrc,
    DateTime? dateOfBirth,
    String? address,
  });
}

/// Mock data with realistic latency so skeletons are visible in dev.
/// Swap for the API-backed implementation when the backend lands.
class MockClientsRepository implements ClientsRepository {
  // NOTE: not `const` — DateTime has no const constructor.
  final _clients = <Client>[
    Client(
      id: 'clt_001',
      name: 'Mwansa Bwalya',
      nrc: '245711/63/1',
      phone: '0971112233',
      risk: RiskLevel.low,
      lendersCount: 2,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00841',
          amount: 8500,
          dueDate: DateTime(2025, 8, 12),
          status: LoanStatus.active,
        ),
        ClientLoanSummary(
          id: 'LN-2025-00712',
          amount: 3000,
          dueDate: DateTime(2025, 3, 4),
          status: LoanStatus.cleared,
        ),
      ],
    ),
    Client(
      id: 'clt_002',
      name: 'Chanda Nkhoma',
      nrc: '318450/12/7',
      phone: '0964455667',
      risk: RiskLevel.medium,
      lendersCount: 1,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00836',
          amount: 3200,
          dueDate: DateTime(2025, 7, 28),
          status: LoanStatus.overdue,
        ),
        ClientLoanSummary(
          id: 'LN-2025-00850',
          amount: 1500,
          dueDate: DateTime(2025, 8, 20),
          status: LoanStatus.active,
        ),
      ],
    ),
    Client(
      id: 'clt_003',
      name: 'Mutale Phiri',
      nrc: '556203/88/4',
      phone: '0957788990',
      risk: RiskLevel.high,
      lendersCount: 3,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00780',
          amount: 4200,
          dueDate: DateTime(2025, 7, 15),
          status: LoanStatus.overdue,
        ),
        ClientLoanSummary(
          id: 'LN-2025-00855',
          amount: 2000,
          dueDate: DateTime(2025, 8, 25),
          status: LoanStatus.active,
        ),
      ],
    ),
    Client(
      id: 'clt_004',
      name: 'Grace Lungu',
      nrc: '102938/45/2',
      phone: '0972233445',
      risk: RiskLevel.low,
      lendersCount: 1,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00847',
          amount: 5100,
          dueDate: DateTime(2025, 7, 30),
          status: LoanStatus.active,
        ),
      ],
    ),
    Client(
      id: 'clt_005',
      name: 'Bupe Chilufya',
      nrc: '774810/21/3',
      phone: '0965556677',
      risk: RiskLevel.low,
      lendersCount: 2,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00860',
          amount: 1200,
          dueDate: DateTime(2025, 8, 18),
          status: LoanStatus.active,
        ),
      ],
    ),
    Client(
      id: 'clt_006',
      name: 'Tamara Mvula',
      nrc: '660321/54/8',
      phone: '0978889900',
      risk: RiskLevel.medium,
      lendersCount: 2,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00852',
          amount: 2750,
          dueDate: DateTime(2025, 8, 10),
          status: LoanStatus.active,
        ),
        ClientLoanSummary(
          id: 'LN-2025-00690',
          amount: 4000,
          dueDate: DateTime(2025, 2, 11),
          status: LoanStatus.cleared,
        ),
      ],
    ),
    Client(
      id: 'clt_007',
      name: 'Joseph Sampa',
      nrc: '445129/33/5',
      phone: '0953334455',
      risk: RiskLevel.high,
      lendersCount: 1,
      loans: [
        ClientLoanSummary(
          id: 'LN-2025-00755',
          amount: 6100,
          dueDate: DateTime(2025, 7, 5),
          status: LoanStatus.overdue,
        ),
      ],
    ),
    const Client(
      id: 'clt_008',
      name: 'Nasilele Mwiya',
      nrc: '991234/56/1',
      phone: '0962223344',
      risk: RiskLevel.low,
      lendersCount: 1,
      loans: [],
    ),
  ];

  @override
  Future<List<Client>> load() async {
    await Future<void>.delayed(const Duration(milliseconds: 900));
    return _clients;
  }

  @override
  Future<Client> getById(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return _clients.firstWhere(
      (c) => c.id == id,
      orElse: () => throw StateError('Client not found'),
    );
  }

  // Demo borrower starts at 40% (invite minted name + phone) so the KYC
  // wizard is exercisable in dev; updateProfile adds the missing pieces.
  String? _mockNrc;
  DateTime? _mockDob;
  String? _mockAddress;

  @override
  Future<ClientProfile> getMe() async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    return _mockProfile();
  }

  @override
  Future<ClientProfile> updateProfile({
    String? nrc,
    DateTime? dateOfBirth,
    String? address,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (nrc != null && nrc.trim().isNotEmpty) _mockNrc = nrc.trim();
    if (dateOfBirth != null) _mockDob = dateOfBirth;
    if (address != null && address.trim().isNotEmpty) {
      _mockAddress = address.trim();
    }
    return _mockProfile();
  }

  ClientProfile _mockProfile() {
    var percent = 40;
    if (_mockNrc != null) percent += 20;
    if (_mockDob != null) percent += 20;
    if (_mockAddress != null) percent += 20;
    return ClientProfile(
      fullName: 'Bupe Chilufya',
      phone: '0975550001',
      nrcMasked: _mockNrc != null ? '••••••/••/•' : null,
      dateOfBirth: _mockDob,
      address: _mockAddress,
      profilePercent: percent.clamp(0, 100),
      complete: percent >= 100,
      missing: [
        if (_mockNrc == null) 'nrc',
        if (_mockDob == null) 'dob',
        if (_mockAddress == null) 'address',
      ],
    );
  }
}

// ---------- DI ----------

// ---------- API-backed implementation ----------

/// Real clients from `/clients` (lender-scoped). The list items carry loan
/// COUNTS, so the loans array is enriched from `/loans` (filtered by phone)
/// and each client's risk band from `/clients/:id/risk`. Small lender
/// portfolios keep the parallel enrichment cheap.
class ApiClientsRepository implements ClientsRepository {
  ApiClientsRepository(this._client);

  final ApiClient _client;

  @override
  Future<List<Client>> load() async {
    final clientsRes = await _client.getA('/clients');
    final raw = (clientsRes.data as Map<String, dynamic>)['items'];
    final items = raw is List
        ? raw.whereType<Map<String, dynamic>>().toList()
        : <Map<String, dynamic>>[];

    // Phone → loan summaries, from one lender-scoped loans fetch.
    final loansByPhone = <String, List<ClientLoanSummary>>{};
    try {
      final loansRes = await _client.getA('/loans');
      final loans = (loansRes.data as Map<String, dynamic>)['items'];
      if (loans is List) {
        for (final l in loans.whereType<Map<String, dynamic>>()) {
          final phone = l['clientPhone'] as String?;
          if (phone == null) continue;
          loansByPhone.putIfAbsent(phone, () => []).add(
                ClientLoanSummary(
                  id: l['id'] as String? ?? '',
                  amount: (l['principal'] as num?)?.toDouble() ?? 0,
                  dueDate: isoDate(l['nextDueDate']) ?? DateTime.now(),
                  status: toLoanStatus(l['status'] as String?),
                ),
              );
        }
      }
    } catch (_) {
      // Loans are a detail; a hiccup here must not blank the client list.
    }

    // Risk band per client — the list card's risk chip.
    final risks = await Future.wait(
      items.map(
        (c) async => _riskOf(c['id'] as String? ?? ''),
      ),
    );

    return [
      for (var i = 0; i < items.length; i++)
        _toClient(
          items[i],
          risks[i],
          loansByPhone[items[i]['phone'] as String?],
        ),
    ];
  }

  @override
  Future<Client> getById(String id) async {
    final clients = await load();
    return clients.firstWhere(
      (c) => c.id == id,
      orElse: () => throw StateError('Client not found'),
    );
  }

  @override
  Future<ClientProfile> getMe() async {
    final res = await _client.getA('/clients/me');
    return _toProfile(res.data as Map<String, dynamic>);
  }

  @override
  Future<ClientProfile> updateProfile({
    String? nrc,
    DateTime? dateOfBirth,
    String? address,
  }) async {
    final res = await _client.patchA(
      '/clients/me/profile',
      data: {
        if (nrc != null && nrc.trim().isNotEmpty) 'nrc': nrc.trim(),
        if (dateOfBirth != null)
          'dateOfBirth':
              '${dateOfBirth.year.toString().padLeft(4, '0')}-'
                  '${dateOfBirth.month.toString().padLeft(2, '0')}-'
                  '${dateOfBirth.day.toString().padLeft(2, '0')}',
        if (address != null && address.trim().isNotEmpty)
          'address': address.trim(),
      },
    );
    return _toProfile(res.data as Map<String, dynamic>);
  }

  ClientProfile _toProfile(Map<String, dynamic> d) => ClientProfile(
        fullName: d['fullName'] as String? ?? '',
        phone: d['phone'] as String? ?? '',
        nrcMasked: d['nrcMasked'] as String?,
        dateOfBirth: isoDate(d['dob']),
        address: d['address'] as String?,
        profilePercent: (d['profilePercent'] as num?)?.toInt() ?? 100,
        complete: (d['profileComplete'] as bool?) ?? true,
        missing: (d['missing'] as List<dynamic>?)
                ?.whereType<String>()
                .toList() ??
            const <String>[],
      );

  Client _toClient(
    Map<String, dynamic> item,
    RiskLevel risk,
    List<ClientLoanSummary>? loans,
  ) =>
      Client(
        id: item['id'] as String? ?? '',
        name: item['name'] as String? ?? '',
        nrc: '',
        phone: item['phone'] as String? ?? '',
        risk: risk,
        lendersCount: (item['lendersCount'] as num?)?.toInt() ?? 0,
        loans: loans ?? const [],
      );

  Future<RiskLevel> _riskOf(String clientId) async {
    try {
      final res = await _client.getA('/clients/$clientId/risk');
      final data = res.data as Map<String, dynamic>;
      return toRiskLevel(data['band'] as String?);
    } catch (_) {
      return RiskLevel.low;
    }
  }
}

// ---------- DI ----------

final clientsRepositoryProvider = Provider<ClientsRepository>(
  (ref) => Env.useMocks
      ? MockClientsRepository()
      : ApiClientsRepository(ref.watch(apiClientProvider)),
);

/// The borrower's own profile + KYC completeness (client self-service).
final clientMeProvider = FutureProvider.autoDispose<ClientProfile>(
  (ref) => ref.watch(clientsRepositoryProvider).getMe(),
);

final clientByIdProvider = FutureProvider.autoDispose.family<Client, String>(
  (ref, id) => ref.watch(clientsRepositoryProvider).getById(id),
);
