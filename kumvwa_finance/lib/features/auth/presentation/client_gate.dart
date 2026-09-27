import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';
import 'package:kumvwa_finance/features/onboarding/domain/registration_gate.dart';

/// One linked lender, with the terms/branding state the home screen gates on.
class LenderStatus {
  const LenderStatus({
    required this.tenantId,
    required this.name,
    required this.primaryColor,
    this.logoUrl,
    required this.termsVersion,
    required this.termsAccepted,
  });

  final String tenantId;
  final String name;

  /// Contextual white-label — M2b uses this to tint loan surfaces; the
  /// tenant-terms sheet already shows the inviting lender's color.
  final String primaryColor;

  /// Presigned logo URL — lender surfaces use it (avatars, headers, sheets).
  final String? logoUrl;
  final int? termsVersion; // null = no terms published → nothing to accept
  final bool termsAccepted;

  bool get needsAcceptance => !termsAccepted;
}

/// Everything the post-login flow needs to decide which screen to show:
/// the profile stepper, the platform terms gate, and per-lender terms
/// nudges — one pair of calls instead of each screen refetching.
class ClientGateState {
  const ClientGateState({
    required this.profileCompleted,
    required this.registration,
    required this.termsVersion,
    required this.termsBody,
    required this.termsAccepted,
    required this.lenders,
  });

  /// The rich stepper (email/employment/income/kin), NOT the KYC wizard's
  /// NRC/DOB/address percent — that older gate stays on the session flag.
  final bool profileCompleted;

  /// Whether this borrower is fully registered, must complete the stepper, or
  /// owes money on a loan and may clear it before the stepper binds them.
  final RegistrationDecision registration;

  final int termsVersion;
  final String termsBody;
  final bool termsAccepted;

  /// Lenders linked to this borrower, each with their terms state.
  final List<LenderStatus> lenders;

  bool get needsTenantTerms => lenders.any((l) => !l.termsAccepted);
}

/// Loads the gate state. Throws [ApiException] (message safe to show) —
/// screens render a retry, and the 401→refresh interceptor runs upstream.
final clientGateProvider = FutureProvider.autoDispose<ClientGateState>((
  ref,
) async {
  final client = ref.watch(apiClientProvider);
  try {
    final results = await Future.wait([
      client.getA('/clients/me'),
      client.getA('/terms/status'),
    ]);
    final me = results[0].data as Map<String, dynamic>;
    final status = results[1].data as Map<String, dynamic>;

    final lendersRaw = (status['lenders'] as List? ?? const [])
        .cast<Map<String, dynamic>>();
    final lenders = lendersRaw
        .map(
          (l) => LenderStatus(
            tenantId: l['tenantId'] as String? ?? '',
            name: l['name'] as String? ?? '',
            primaryColor: (l['primaryColor'] as String?) ?? '#1A4FBF',
            logoUrl: l['logoUrl'] as String?,
            termsVersion: l['termsVersion'] as int?,
            // API returns true when no terms are published — mirror that.
            termsAccepted: l['termsAccepted'] as bool? ?? true,
          ),
        )
        .toList();

    // The server judges the registration from the merged record it holds, so
    // the app never re-derives completion from a stale flag. Older API
    // responses without the `registration` block fall back to comparing the
    // stepper's required fields against the profile itself.
    final registrationBlock = me['registration'];
    final registration = registrationBlock is Map<String, dynamic>
        ? evaluateRegistrationFrom(
            missing:
                (registrationBlock['missing'] as List<dynamic>? ?? const [])
                    .whereType<String>()
                    .toList(),
            openLoanCount:
                (registrationBlock['openLoanCount'] as num?)?.toInt() ?? 0,
            openTotalOutstanding:
                (registrationBlock['openTotalOutstanding'] as num?)
                    ?.toDouble() ??
                0,
          )
        : evaluateRegistrationFrom(
            missing: missingRegistrationFields(
              clientProfileFromJson(me),
            ).map((f) => f.name).toList(),
          );

    return ClientGateState(
      profileCompleted: me['profileCompleted'] as bool? ?? false,
      registration: registration,
      termsVersion:
          (status['platform'] as Map<String, dynamic>)['version'] as int? ?? 1,
      termsBody:
          (status['platform'] as Map<String, dynamic>)['body'] as String? ?? '',
      termsAccepted:
          (status['platform'] as Map<String, dynamic>)['accepted'] as bool? ??
          false,
      lenders: lenders,
    );
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
});
