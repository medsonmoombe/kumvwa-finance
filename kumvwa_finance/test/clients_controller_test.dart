import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client.dart';
import 'package:kumvwa_finance/features/clients/presentation/clients_controller.dart';

// ---------- fixtures ----------

ClientLoanSummary loan(String id, LoanStatus status) => ClientLoanSummary(
  id: id,
  amount: 100,
  dueDate: DateTime(2025, 8, 12),
  status: status,
);

Client client({
  required String id,
  required String name,
  String nrc = '000000/00/0',
  String phone = '0970000000',
  RiskLevel risk = RiskLevel.low,
  List<ClientLoanSummary> loans = const [],
}) => Client(
  id: id,
  name: name,
  nrc: nrc,
  phone: phone,
  risk: risk,
  lendersCount: 1,
  loans: loans,
);

/// A small ledger mirroring the four interesting shapes: active-only,
/// active+overdue, overdue-only, and no loans at all.
final fixture = <Client>[
  client(
    id: 'a',
    name: 'Mwansa Bwalya',
    nrc: '245711/63/1',
    phone: '0971112233',
    loans: [loan('L1', LoanStatus.active)],
  ),
  client(
    id: 'b',
    name: 'Chanda Nkhoma',
    nrc: '318450/12/7',
    phone: '0964455667',
    risk: RiskLevel.medium,
    loans: [loan('L2', LoanStatus.overdue), loan('L3', LoanStatus.active)],
  ),
  client(
    id: 'c',
    name: 'Mutale Phiri',
    nrc: '556203/88/4',
    phone: '0957788990',
    risk: RiskLevel.high,
    loans: [loan('L4', LoanStatus.overdue)],
  ),
  client(
    id: 'd',
    name: 'Joseph Sampa',
    nrc: '445129/33/5',
    phone: '0953334455',
    risk: RiskLevel.high,
  ),
];

List<String> idsOf(List<Client> clients) => clients.map((c) => c.id).toList();

// ---------- test doubles ----------

class _FakeClientsRepository implements ClientsRepository {
  _FakeClientsRepository({this.clients = const [], this.fail = false});

  final List<Client> clients;
  final bool fail;
  var loadCalls = 0;

  @override
  Future<List<Client>> load() async {
    loadCalls++;
    if (fail) throw StateError('boom');
    return clients;
  }

  @override
  Future<Client> getById(String id) async =>
      clients.firstWhere((c) => c.id == id);
}

ProviderContainer containerWith(ClientsRepository repo) {
  final container = ProviderContainer(
    overrides: [clientsRepositoryProvider.overrideWithValue(repo)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('ClientsState.filtered', () {
    test('returns everything with no query and the All filter', () {
      expect(
        ClientsState(clients: fixture).filtered,
        hasLength(fixture.length),
      );
    });

    test('is empty while loading', () {
      expect(const ClientsState().filtered, isEmpty);
      expect(const ClientsState().isLoading, isTrue);
    });

    test('matches the name case-insensitively', () {
      expect(idsOf(ClientsState(clients: fixture, query: 'mwansa').filtered), ['a']);
      expect(idsOf(ClientsState(clients: fixture, query: 'MWANSA').filtered), ['a']);
      expect(idsOf(ClientsState(clients: fixture, query: 'phiri').filtered), ['c']);
    });

    test('trims the query before matching', () {
      expect(
        idsOf(ClientsState(clients: fixture, query: '  mwansa  ').filtered),
        ['a'],
      );
    });

    test('matches on NRC', () {
      expect(idsOf(ClientsState(clients: fixture, query: '245711').filtered), ['a']);
      expect(idsOf(ClientsState(clients: fixture, query: '556203/88/4').filtered), ['c']);
    });

    test('matches on phone digits', () {
      expect(idsOf(ClientsState(clients: fixture, query: '0971').filtered), ['a']);
      expect(idsOf(ClientsState(clients: fixture, query: '0964455667').filtered), ['b']);
    });

    test('returns nothing when the query matches no client', () {
      expect(ClientsState(clients: fixture, query: 'zzz').filtered, isEmpty);
    });

    test('Active filter keeps clients with any active loan', () {
      expect(
        idsOf(ClientsState(clients: fixture, filter: ClientFilter.active).filtered),
        ['a', 'b'],
      );
    });

    test('Overdue filter keeps clients with any overdue loan', () {
      expect(
        idsOf(ClientsState(clients: fixture, filter: ClientFilter.overdue).filtered),
        ['b', 'c'],
      );
    });

    test('High risk filter keys off the risk band only', () {
      expect(
        idsOf(ClientsState(clients: fixture, filter: ClientFilter.highRisk).filtered),
        ['c', 'd'],
      );
    });

    test('search and filter combine', () {
      expect(
        idsOf(
          ClientsState(
            clients: fixture,
            query: 'mutale',
            filter: ClientFilter.overdue,
          ).filtered,
        ),
        ['c'],
      );
      expect(
        ClientsState(
          clients: fixture,
          query: 'chanda',
          filter: ClientFilter.highRisk,
        ).filtered,
        isEmpty,
      );
    });
  });

  group('ClientsState.copyWith', () {
    test('keeps existing values when nothing is passed', () {
      const state = ClientsState(error: 'nope', query: 'q', filter: ClientFilter.overdue);
      final next = state.copyWith();

      expect(next.error, 'nope');
      expect(next.query, 'q');
      expect(next.filter, ClientFilter.overdue);
    });

    test('replaces query and filter', () {
      final next = const ClientsState().copyWith(
        query: 'mwansa',
        filter: ClientFilter.highRisk,
      );

      expect(next.query, 'mwansa');
      expect(next.filter, ClientFilter.highRisk);
    });

    test('clearError drops the error without touching the rest', () {
      final next = const ClientsState(error: 'nope', query: 'q').copyWith(
        clearError: true,
      );

      expect(next.error, isNull);
      expect(next.query, 'q');
    });

    test('reports loading only when there is neither data nor an error', () {
      expect(const ClientsState().isLoading, isTrue);
      expect(const ClientsState(clients: <Client>[]).isLoading, isFalse);
      expect(const ClientsState(error: 'x').isLoading, isFalse);
    });
  });

  group('ClientsController', () {
    test('starts loading, then exposes the repository data', () async {
      final container = containerWith(_FakeClientsRepository(clients: fixture));

      expect(container.read(clientsControllerProvider).isLoading, isTrue);

      await pumpEventQueue();

      final state = container.read(clientsControllerProvider);
      expect(state.isLoading, isFalse);
      expect(state.clients, hasLength(fixture.length));
      expect(state.error, isNull);
    });

    test('setQuery and setFilter update state without reloading', () async {
      final repo = _FakeClientsRepository(clients: fixture);
      final container = containerWith(repo);
      await pumpEventQueue();

      final controller = container.read(clientsControllerProvider.notifier);
      controller.setQuery('mwansa');
      controller.setFilter(ClientFilter.highRisk);

      expect(container.read(clientsControllerProvider).query, 'mwansa');
      expect(container.read(clientsControllerProvider).filter, ClientFilter.highRisk);
      expect(repo.loadCalls, 1); // filtering never re-hits the repository
    });

    test('clearSearch resets both query and filter', () async {
      final container = containerWith(_FakeClientsRepository(clients: fixture));
      await pumpEventQueue();

      final controller = container.read(clientsControllerProvider.notifier);
      controller.setQuery('mwansa');
      controller.setFilter(ClientFilter.overdue);
      controller.clearSearch();

      final state = container.read(clientsControllerProvider);
      expect(state.query, isEmpty);
      expect(state.filter, ClientFilter.all);
    });

    test('reload returns to loading but keeps the query and filter', () async {
      final container = containerWith(_FakeClientsRepository(clients: fixture));
      await pumpEventQueue();

      final controller = container.read(clientsControllerProvider.notifier);
      controller.setQuery('mwansa');
      controller.setFilter(ClientFilter.active);

      final pending = controller.reload();
      expect(container.read(clientsControllerProvider).isLoading, isTrue);

      await pending;

      final state = container.read(clientsControllerProvider);
      expect(state.clients, hasLength(fixture.length));
      expect(state.query, 'mwansa');
      expect(state.filter, ClientFilter.active);
    });

    test('a repository failure surfaces a safe error message', () async {
      final container = containerWith(_FakeClientsRepository(fail: true));
      // ProviderContainer is lazy: read it so build() kicks off the load.
      container.read(clientsControllerProvider);

      await pumpEventQueue();

      final state = container.read(clientsControllerProvider);
      expect(state.error, 'Could not load clients');
      expect(state.clients, isNull);
      expect(state.isLoading, isFalse);
    });

    test('a successful load leaves no error behind', () async {
      final container = containerWith(_FakeClientsRepository(clients: fixture));
      await pumpEventQueue();

      final controller = container.read(clientsControllerProvider.notifier);
      await controller.reload();

      expect(container.read(clientsControllerProvider).error, isNull);
      expect(container.read(clientsControllerProvider).clients, isNotNull);
    });
  });

  group('against the seeded client ledger', () {
    late List<Client> seed;

    setUpAll(() async => seed = await MockClientsRepository().load());

    test('the Clients tab badge counts 8 clients', () {
      expect(ClientsState(clients: seed).filtered, hasLength(8));
    });

    test('Overdue chip shows 3 clients', () {
      expect(
        idsOf(ClientsState(clients: seed, filter: ClientFilter.overdue).filtered),
        hasLength(3),
      );
    });

    test('Active chip shows 6 clients', () {
      expect(
        idsOf(ClientsState(clients: seed, filter: ClientFilter.active).filtered),
        hasLength(6),
      );
    });

    test('High risk chip shows 2 clients', () {
      expect(
        idsOf(ClientsState(clients: seed, filter: ClientFilter.highRisk).filtered),
        hasLength(2),
      );
    });

    test('searching by NRC finds the borrower', () {
      final results = ClientsState(clients: seed, query: '245711').filtered;
      expect(results.single.name, 'Mwansa Bwalya');
    });

    test('a nonsense query yields the empty state', () {
      expect(ClientsState(clients: seed, query: '999').filtered, isEmpty);
    });
  });
}
