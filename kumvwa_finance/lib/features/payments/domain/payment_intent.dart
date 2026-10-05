import 'package:flutter/foundation.dart';

import 'package:kumvwa_finance/core/domain/pay_provider.dart';

/// Re-exported so callers get the whole payment vocabulary from one import.
export 'package:kumvwa_finance/core/domain/pay_provider.dart' show PayProvider;

/// Payment lifecycle, mirroring `@kumvwa/core`'s `PaymentStatus`.
///
/// The client mirrors the server's vocabulary rather than inventing its own
/// states, so a receipt rendered here means the same thing as the row in the
/// console's ledger. Unknown strings from a newer server fall back to
/// [PaymentStatus.unknown] instead of throwing — an app release cycle behind the
/// API should degrade, not crash.
enum PaymentStatus {
  requiresAction,
  processing,
  succeeded,
  failed,
  cancelled,
  expired,
  refunded,
  partiallyRefunded,
  unknown,
}

PaymentStatus paymentStatusFrom(String? raw) => switch (raw) {
  'requires_action' => PaymentStatus.requiresAction,
  'processing' => PaymentStatus.processing,
  'succeeded' => PaymentStatus.succeeded,
  'failed' => PaymentStatus.failed,
  'cancelled' => PaymentStatus.cancelled,
  'expired' => PaymentStatus.expired,
  'refunded' => PaymentStatus.refunded,
  'partially_refunded' => PaymentStatus.partiallyRefunded,
  _ => PaymentStatus.unknown,
};

extension PaymentStatusX on PaymentStatus {
  bool get isFinal =>
      this == PaymentStatus.succeeded ||
      this == PaymentStatus.failed ||
      this == PaymentStatus.cancelled ||
      this == PaymentStatus.expired ||
      this == PaymentStatus.refunded ||
      this == PaymentStatus.partiallyRefunded;

  /// Still moving — the user should be told to wait, not to retry.
  bool get isPending =>
      this == PaymentStatus.requiresAction || this == PaymentStatus.processing;

  /// Money moved. Only these warrant a "paid" receipt.
  bool get isPaid => this == PaymentStatus.succeeded;

  /// Terminal without money moving. Safe to retry.
  bool get isDead =>
      this == PaymentStatus.failed ||
      this == PaymentStatus.cancelled ||
      this == PaymentStatus.expired;

  String get label => switch (this) {
    PaymentStatus.requiresAction => 'Awaiting approval',
    PaymentStatus.processing => 'Processing',
    PaymentStatus.succeeded => 'Paid',
    PaymentStatus.failed => 'Failed',
    PaymentStatus.cancelled => 'Cancelled',
    PaymentStatus.expired => 'Expired',
    PaymentStatus.refunded => 'Refunded',
    PaymentStatus.partiallyRefunded => 'Partly refunded',
    PaymentStatus.unknown => 'Unknown',
  };
}

/// Unparseable rail from the API. Mobile money is the overwhelmingly common
/// case, so that is the fallback, but it is only ever used for *display* — the
/// charge itself already went to whatever rail the API chose.
PayProvider payProviderFrom(String? raw) =>
    PayProvider.fromWire(raw) ?? PayProvider.mtnMomo;

/// One payment as the API reports it. BigInt money arrives as a *string*
/// (`amountMinor`), which is why this keeps the string and derives a double
/// rather than parsing in the transport layer.
@immutable
class PaymentIntent {
  const PaymentIntent({
    required this.id,
    required this.reference,
    required this.purpose,
    required this.status,
    required this.amountMinor,
    required this.currency,
    required this.provider,
    this.payerPhone,
    this.loanId,
    this.failureReason,
    this.createdAt,
  });

  final String id;

  /// Human reference (`PAY-2026-00001`) — what a borrower quotes to support.
  final String reference;
  final String purpose;
  final PaymentStatus status;

  /// Minor units as a string, exactly as sent. Never parsed for arithmetic.
  final String amountMinor;
  final String currency;
  final PayProvider provider;
  final String? payerPhone;
  final String? loanId;
  final String? failureReason;
  final DateTime? createdAt;

  /// Kwacha for display. Derived from the minor-unit string so a value the app
  /// cannot represent is never used to compute a charge.
  double get amountKwacha {
    final minor = int.tryParse(amountMinor);
    return minor == null ? 0 : minor / 100;
  }

  factory PaymentIntent.fromJson(Map<String, dynamic> json) => PaymentIntent(
    id: json['id'] as String? ?? '',
    reference: json['reference'] as String? ?? '',
    purpose: json['purpose'] as String? ?? 'other',
    status: paymentStatusFrom(json['status'] as String?),
    amountMinor: _minorString(json['amountMinor']),
    currency: json['currency'] as String? ?? 'ZMW',
    provider: payProviderFrom(json['provider'] as String?),
    payerPhone: json['payerPhone'] as String?,
    loanId: json['loanId'] as String?,
    failureReason: json['failureReason'] as String?,
    createdAt: DateTime.tryParse(json['createdAt'] as String? ?? ''),
  );
}

/// Minor units can arrive as a string (BigInt) or a number depending on the
/// endpoint. Normalising here keeps every call site from having to guess.
String _minorString(dynamic value) => switch (value) {
  final String s => s,
  final num n => n.toInt().toString(),
  _ => '0',
};
