import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client.dart';

enum ClientFilter { all, active, overdue, highRisk }

extension ClientFilterX on ClientFilter {
  String get label => switch (this) {
    ClientFilter.all => 'All',
    ClientFilter.active => 'Active',
    ClientFilter.overdue => 'Overdue',
    ClientFilter.highRisk => 'High risk',
  };
}

class ClientsState {
  const ClientsState({
    this.clients,
    this.error,
    this.query = '',
    this.filter = ClientFilter.all,
  });

  final List<Client>? clients; // null = loading
  final String? error;
  final String query;
  final ClientFilter filter;

  bool get isLoading => clients == null && error == null;

  List<Client> get filtered {
    final all = clients ?? const <Client>[];
    final q = query.trim().toLowerCase();
    return all.where((c) {
      final matchesFilter = switch (filter) {
        ClientFilter.all => true,
        ClientFilter.active => c.hasActiveLoans,
        ClientFilter.overdue => c.hasOverdueLoans,
        ClientFilter.highRisk => c.risk == RiskLevel.high,
      };
      if (!matchesFilter) return false;
      if (q.isEmpty) return true;
      return c.name.toLowerCase().contains(q) ||
          c.nrc.toLowerCase().contains(q) ||
          c.phone.contains(q);
    }).toList();
  }

  ClientsState copyWith({
    List<Client>? clients,
    String? error,
    bool clearError = false,
    String? query,
    ClientFilter? filter,
  }) {
    return ClientsState(
      clients: clients ?? this.clients,
      error: clearError ? null : (error ?? this.error),
      query: query ?? this.query,
      filter: filter ?? this.filter,
    );
  }
}

class ClientsController extends Notifier<ClientsState> {
  @override
  ClientsState build() {
    _load();
    return const ClientsState();
  }

  Future<void> _load() async {
    try {
      final clients = await ref.read(clientsRepositoryProvider).load();
      state = state.copyWith(clients: clients, clearError: true);
    } catch (_) {
      state = state.copyWith(error: 'Could not load clients');
    }
  }

  /// Pull-to-refresh: back to loading, keep query + filter.
  Future<void> reload() async {
    state = ClientsState(query: state.query, filter: state.filter);
    await _load();
  }

  void setQuery(String q) => state = state.copyWith(query: q);
  void setFilter(ClientFilter f) => state = state.copyWith(filter: f);

  void clearSearch() =>
      state = state.copyWith(query: '', filter: ClientFilter.all);
}

final clientsControllerProvider =
    NotifierProvider<ClientsController, ClientsState>(ClientsController.new);
