import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

abstract class InviteRepository {
  Future<ClientInvite> createInvite({
    required String clientName,
    required String phone,
  });

  /// Throws [InviteException] when the token is unknown.
  Future<ClientInvite> getByToken(String token);

  Future<void> submitProfile({
    required String token,
    required String nrc,
    required DateTime dateOfBirth,
    required String address,
  });
}

/// In-memory mock — invites die on app restart (expected in dev).
/// Swap for the API-backed implementation later; nothing else changes.
class MockInviteRepository implements InviteRepository {
  final _invites = <String, ClientInvite>{};
  var _counter = 0;

  @override
  Future<ClientInvite> createInvite({
    required String clientName,
    required String phone,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    final token = 'INV${1000 + _counter++}';
    final invite = ClientInvite(
      token: token,
      // Mock: the real API derives this from the auth token.
      businessName: 'Chilenje Community SACCO',
      clientName: clientName.trim(),
      phone: phone.trim(),
    );
    _invites[token] = invite;
    return invite;
  }

  @override
  Future<ClientInvite> getByToken(String token) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final invite = _invites[token.trim().toUpperCase()];
    if (invite == null) {
      throw const InviteException(
        'This invite link is invalid or has expired.',
      );
    }
    return invite;
  }

  @override
  Future<void> submitProfile({
    required String token,
    required String nrc,
    required DateTime dateOfBirth,
    required String address,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final invite = _invites[token];
    if (invite == null) {
      throw const InviteException('This invite is no longer valid.');
    }
    invite.completed = true;
  }
}

// ---------- DI ----------

final inviteRepositoryProvider = Provider<InviteRepository>(
  (ref) => MockInviteRepository(),
);

/// Loads the invite behind a deep-linked token.
final inviteByTokenProvider = FutureProvider.autoDispose
    .family<ClientInvite, String>(
      (ref, token) => ref.watch(inviteRepositoryProvider).getByToken(token),
    );
