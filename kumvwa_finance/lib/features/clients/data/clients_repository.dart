import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/network/api_parse.dart';
import 'package:kumvwa_finance/features/profile/domain/client_profile.dart';

/// Client self-service repository — the lender-facing client roster moved to
/// the web console (M2b trim); the mobile app only ever reads/writes the
/// signed-in borrower's own profile (KYC wizard).
abstract class ClientsRepository {
  /// The borrower's own profile + KYC completeness.
  Future<ClientProfile> getMe();

  /// A presigned URL for one face (`front`/`back`) of the borrower's OWN
  /// uploaded NRC, so the app can show them what is on file. Minted per call
  /// and short-lived by design — fetch it when the viewer opens, never cache
  /// it. Throws [ApiException] when that face was never uploaded.
  Future<String> nrcPhotoUrl({required String side});

  /// Post-login KYC wizard target. Returns the refreshed profile.
  Future<ClientProfile> updateProfile({
    String? nrc,
    DateTime? dateOfBirth,
    String? address,
  });
}

class ApiClientsRepository implements ClientsRepository {
  ApiClientsRepository(this._client);

  final ApiClient _client;

  @override
  Future<ClientProfile> getMe() async {
    final res = await _client.getA('/clients/me');
    return clientProfileFromJson(res.data as Map<String, dynamic>);
  }

  @override
  Future<String> nrcPhotoUrl({required String side}) async {
    final res = await _client.getA('/clients/me/nrc-photo/$side');
    final url = (res.data as Map<String, dynamic>)['url'] as String?;
    if (url == null || url.isEmpty) {
      throw const ApiException('The photo could not be opened. Try again.');
    }
    return url;
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
    return clientProfileFromJson(res.data as Map<String, dynamic>);
  }
}

/// Maps a `/clients/me` payload onto [ClientProfile]. Top-level so the gate
/// can compare the same response against the stepper's required fields
/// without constructing a repository.
ClientProfile clientProfileFromJson(Map<String, dynamic> d) {
    final registration =
        d['registration'] as Map<String, dynamic>? ?? const <String, dynamic>{};
    return ClientProfile(
      fullName: d['fullName'] as String? ?? '',
      phone: d['phone'] as String? ?? '',
      email: d['email'] as String?,
      nrcMasked: d['nrcMasked'] as String?,
      dateOfBirth: isoDate(d['dob']),
      address: d['address'] as String?,
      employmentStatus: d['employmentStatus'] as String?,
      educationLevel: d['educationLevel'] as String?,
      incomeBand: d['incomeBand'] as String?,
      incomeSource: d['incomeSource'] as String?,
      kinName: d['kinName'] as String?,
      kinPhone: d['kinPhone'] as String?,
      nrcPhotoFileId: d['nrcPhotoFileId'] as String?,
      nrcBackPhotoFileId: d['nrcBackPhotoFileId'] as String?,
      missingRegistrationFields:
          (registration['missing'] as List<dynamic>?)
              ?.whereType<String>()
              .toList() ??
          const <String>[],
      registrationOpenLoanCount:
          (registration['openLoanCount'] as num?)?.toInt() ?? 0,
      registrationOpenTotal:
          (registration['openTotalOutstanding'] as num?)?.toDouble() ?? 0,
      profilePercent: (d['profilePercent'] as num?)?.toInt() ?? 100,
      complete: (d['profileComplete'] as bool?) ?? true,
      missing:
          (d['missing'] as List<dynamic>?)?.whereType<String>().toList() ??
          const <String>[],
    );
  }

/// Dev-mode stand-in: an already-complete profile, so the KYC wizard
/// renders its done state without a backend.
class MockSelfClientsRepository implements ClientsRepository {
  ClientProfile get _complete => ClientProfile(
    fullName: 'Demo Borrower',
    phone: '0971112233',
    email: 'demo.borrower@example.com',
    nrcMasked: '245711/63/1',
    dateOfBirth: DateTime(1997, 3, 3),
    address: 'Plot 12, Kabwata, Lusaka',
    employmentStatus: 'formal_employment',
    educationLevel: 'degree',
    incomeBand: 'b3001_6000',
    incomeSource: 'Government / Public sector',
    kinName: 'Jane Doe',
    kinPhone: '0965000001',
    profilePercent: 100,
    complete: true,
    missing: <String>[],
  );

  @override
  Future<ClientProfile> getMe() async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    return _complete;
  }

  /// The mock profile has no uploaded photos, so the viewer's "View" link is
  /// never rendered in mock mode — nothing to serve.
  @override
  Future<String> nrcPhotoUrl({required String side}) async {
    await Future<void>.delayed(const Duration(milliseconds: 300));
    throw const ApiException('NRC photos are only available against the API.');
  }

  @override
  Future<ClientProfile> updateProfile({
    String? nrc,
    DateTime? dateOfBirth,
    String? address,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 400));
    return _complete;
  }
}

// ---------- DI ----------

final clientsRepositoryProvider = Provider<ClientsRepository>(
  (ref) => Env.useMocks
      ? MockSelfClientsRepository()
      : ApiClientsRepository(ref.watch(apiClientProvider)),
);

/// The borrower's own profile + KYC completeness (client self-service).
final clientMeProvider = FutureProvider.autoDispose<ClientProfile>(
  (ref) => ref.watch(clientsRepositoryProvider).getMe(),
);
