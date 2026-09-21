import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/features/clients/domain/client.dart';

abstract class ClientsRepository {
  Future<List<Client>> load();
  Future<Client> getById(String id);
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
}

// ---------- DI ----------

final clientsRepositoryProvider = Provider<ClientsRepository>(
  (ref) => MockClientsRepository(),
);

final clientByIdProvider = FutureProvider.autoDispose.family<Client, String>(
  (ref, id) => ref.watch(clientsRepositoryProvider).getById(id),
);
