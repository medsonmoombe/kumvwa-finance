import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

abstract class InviteRepository {
  /// Lender-side: mint a short invite code for a client.
  ///
  /// `email` is required by the API — the invite is delivered by email (there
  /// is no SMS channel yet), so a create without it is rejected with a 400.
  Future<ClientInvite> createInvite({
    required String clientName,
    required String phone,
    required String email,
  });

  /// Public lookup so the app can show who invited whom before the client
  /// commits. Throws [InviteException] when the code is unknown/expired/used.
  Future<ClientInvite> getByCode(String code);

  /// Option-A onboarding: the invite code mints the ACCOUNT (name +
  /// password). KYC (NRC / DOB / address) is completed post-login in the
  /// app's profile wizard.
  Future<void> submitAccount({
    required String code,
    required String fullName,
    required String password,
    required bool consent,
  });
}

/// In-memory mock — invites die on app restart (expected in dev).
class MockInviteRepository implements InviteRepository {
  final _invites = <String, ClientInvite>{};
  var _counter = 0;

  @override
  Future<ClientInvite> createInvite({
    required String clientName,
    required String phone,
    required String email,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 700));
    final code = 'KMV-${1000 + _counter++}';
    final invite = ClientInvite(
      code: code,
      // Mock: the real API derives this from the auth token.
      businessName: 'Chilenje Community SACCO',
      clientName: clientName.trim(),
      phone: phone.trim(),
      link: 'https://kumvwa.finance',
    );
    _invites[code] = invite;
    return invite;
  }

  @override
  Future<ClientInvite> getByCode(String code) async {
    await Future<void>.delayed(const Duration(milliseconds: 500));
    final invite = _invites[code.trim().toUpperCase()];
    if (invite == null) {
      throw const InviteException(
        'This invite code is invalid or has expired.',
      );
    }
    return invite;
  }

  @override
  Future<void> submitAccount({
    required String code,
    required String fullName,
    required String password,
    required bool consent,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 800));
    final invite = _invites[code.trim().toUpperCase()];
    if (invite == null) {
      throw const InviteException('This invite is no longer valid.');
    }
    invite.completed = true;
  }
}

// ---------- API-backed implementation ----------

/// Real invites against the short-code endpoints:
///  * `POST /invites` (lender) — creation.
///  * `GET /invites/:code` (public) — pre-claim lookup.
///  * `POST /invites/:code/complete` (public) — account creation.
class ApiInviteRepository implements InviteRepository {
  ApiInviteRepository(this._client);

  final ApiClient _client;

  @override
  Future<ClientInvite> createInvite({
    required String clientName,
    required String phone,
    required String email,
  }) async {
    try {
      final results = await Future.wait([
        _client.postA(
          '/invites',
          data: {
            'clientName': clientName.trim(),
            'phone': toE164(phone.trim()),
            'email': email.trim(),
          },
        ),
        _client.getA('/tenants/me'),
      ]);
      final data = results[0].data as Map<String, dynamic>;
      final tenant = results[1].data as Map<String, dynamic>;
      return ClientInvite(
        code: (data['code'] as String?) ?? (data['token'] as String? ?? ''),
        businessName: tenant['name'] as String? ?? '',
        clientName: data['clientName'] as String? ?? clientName.trim(),
        phone: data['phone'] as String? ?? phone.trim(),
        link: data['link'] as String?,
      );
    } on DioException catch (e) {
      throw InviteException(_friendly(ApiException.fromDio(e)));
    }
  }

  @override
  Future<ClientInvite> getByCode(String code) async {
    try {
      final res = await _client.getPublic('/invites/${code.trim()}');
      final data = res.data as Map<String, dynamic>;
      return ClientInvite(
        code: code.trim().toUpperCase(),
        businessName: data['businessName'] as String? ?? '',
        clientName: data['clientName'] as String? ?? '',
        phone: data['phone'] as String? ?? '',
        phoneMasked: data['phoneMasked'] as String?,
        link: data['link'] as String?,
        // Pre-login white-label — the API already resolves the logo through
        // the storage service; the screen would otherwise ignore it.
        primaryColor: data['primaryColor'] as String? ?? '#1A4FBF',
        logoUrl: data['logoUrl'] as String?,
        tagline: data['tagline'] as String?,
      );
    } on DioException catch (e) {
      throw InviteException(_friendly(ApiException.fromDio(e)));
    }
  }

  @override
  Future<void> submitAccount({
    required String code,
    required String fullName,
    required String password,
    required bool consent,
  }) async {
    try {
      await _client.postPublic(
        '/invites/${code.trim()}/complete',
        data: {
          'fullName': fullName.trim(),
          'password': password,
          'consent': consent,
        },
      );
    } on DioException catch (e) {
      throw InviteException(_friendly(ApiException.fromDio(e)));
    }
  }

  static String _friendly(ApiException e) => switch (e.statusCode) {
    404 => 'This invite code is invalid or has expired.',
    409 => e.message,
    // A 402 here is the *lender's* plan, not the borrower's — the slot is
    // paid for by whoever invited them, and the server's message says "buy an
    // extra client slot", which is meaningless (and un-actionable) on a
    // borrower's phone. Never show it verbatim: it would tell someone to go
    // buy something they cannot buy, and imply the fault is theirs.
    402 when e.isClientLimit =>
      'This lender has used all the client places on their plan. '
      'Ask them to add a place, then use this code again.',
    _ => e.message,
  };
}

// ---------- DI ----------

final inviteRepositoryProvider = Provider<InviteRepository>(
  (ref) => Env.useMocks
      ? MockInviteRepository()
      : ApiInviteRepository(ref.watch(apiClientProvider)),
);

/// Loads the invite behind a typed code.
final inviteByCodeProvider = FutureProvider.autoDispose
    .family<ClientInvite, String>(
      (ref, code) => ref.watch(inviteRepositoryProvider).getByCode(code),
    );
