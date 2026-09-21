import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/domain/risk_level.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';

void main() {
  late MockClientsRepository repo;

  setUp(() => repo = MockClientsRepository());

  test('load returns the 8 seeded clients with unique ids', () async {
    final clients = await repo.load();

    expect(clients, hasLength(8));
    expect(clients.map((c) => c.id).toSet(), hasLength(8));
  });

  test('the seed covers all three risk bands', () async {
    final clients = await repo.load();

    expect(clients.where((c) => c.risk == RiskLevel.low), isNotEmpty);
    expect(clients.where((c) => c.risk == RiskLevel.medium), isNotEmpty);
    expect(clients.where((c) => c.risk == RiskLevel.high), hasLength(2));
  });

  test('load returns the same instance on repeat calls', () async {
    expect(identical(await repo.load(), await repo.load()), isTrue);
  });

  test('one seeded client has no loans at all', () async {
    final clients = await repo.load();

    expect(clients.where((c) => c.loans.isEmpty), hasLength(1));
  });

  test('getById returns the matching client', () async {
    final client = await repo.getById('clt_001');

    expect(client.name, 'Mwansa Bwalya');
    expect(client.nrc, '245711/63/1');
    expect(client.phone, '0971112233');
    expect(client.lendersCount, 2);
    expect(client.loans, hasLength(2));
  });

  test('getById exposes loan statuses from the client ledger', () async {
    final chanda = await repo.getById('clt_002');

    expect(chanda.hasOverdueLoans, isTrue);
    expect(chanda.hasActiveLoans, isTrue);
    expect(
      chanda.loans.map((l) => l.status),
      [LoanStatus.overdue, LoanStatus.active],
    );
  });

  test('getById throws StateError for an unknown id', () async {
    expect(() => repo.getById('clt_999'), throwsStateError);
  });
}
