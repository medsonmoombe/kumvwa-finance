import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/features/payments/domain/payment_intent.dart';

/// Paying a loan, and reading back what has been paid.
abstract class PaymentsRepository {
  /// Raises a payment intent for [loanId] and returns the server's view of it.
  ///
  /// This is the only correct way to take a borrower's money: the API owns the
  /// amount, picks the rail from the registered phone, and settles the loan
  /// balance itself once the provider confirms. The app never posts a
  /// "mark as paid" — that would let a client claim a payment it never made.
  Future<PaymentIntent> payLoan({
    required String loanId,
    required double amountKwacha,
    PayProvider? provider,
    String? phone,
  });

  /// Re-reads an intent, which also asks the provider for its current answer.
  Future<PaymentIntent> status(String intentId);

  /// Everything the signed-in user has paid or is paying, newest first.
  Future<List<PaymentIntent>> receipts({String? loanId, int limit = 50});
}

class ApiPaymentsRepository implements PaymentsRepository {
  ApiPaymentsRepository(this._client);

  final ApiClient _client;

  /// One key per (loan, amount) so a retry after a dropped connection replays
  /// the same intent instead of starting a second charge. The key is dropped as
  /// soon as we know the outcome — a *refused* request must not be replayed,
  /// or the borrower's corrected attempt would return the old failure.
  final Map<String, String> _operationKeys = {};

  String _keyFor(String operation) =>
      _operationKeys.putIfAbsent(operation, () => const Uuid().v4());

  void _complete(String operation) => _operationKeys.remove(operation);

  /// A network-level failure leaves the outcome genuinely unknown: the charge
  /// may well have been accepted. Those keep their key so a retry is safe.
  static bool _isUncertain(DioException e) =>
      e.response == null ||
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.sendTimeout ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.connectionError;

  @override
  Future<PaymentIntent> payLoan({
    required String loanId,
    required double amountKwacha,
    PayProvider? provider,
    String? phone,
  }) async {
    final operation = 'repay:$loanId:${amountKwacha.toStringAsFixed(2)}';
    final key = _keyFor(operation);
    try {
      final res = await _client.postA(
        '/payments/intents',
        data: {
          'purpose': 'loan_repayment',
          'loanId': loanId,
          'amount': amountKwacha,
          if (provider != null && provider != PayProvider.bank)
            'provider': provider.wire,
          if (phone != null && phone.isNotEmpty) 'phone': phone,
        },
        headers: {'Idempotency-Key': key},
      );
      // The intent is now durable on the server, so a later poll of this same
      // operation is a read, not a second charge. Release the key.
      _complete(operation);
      return PaymentIntent.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      if (!_isUncertain(e)) _complete(operation);
      throw ApiException.fromDio(e);
    }
  }

  @override
  Future<PaymentIntent> status(String intentId) async {
    try {
      // GET re-syncs against the provider server-side, so this is the call the
      // pay sheet's poll loop uses rather than trusting its own optimism.
      final res = await _client.getA('/payments/intents/$intentId');
      return PaymentIntent.fromJson(res.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }

  @override
  Future<List<PaymentIntent>> receipts({String? loanId, int limit = 50}) async {
    try {
      final res = await _client.getA(
        '/payments',
        query: {
          'purpose': 'loan_repayment',
          'limit': limit,
        },
      );
      final body = res.data as Map<String, dynamic>;
      final items = body['items'] as List<dynamic>? ?? const [];
      final payments = items
          .whereType<Map<String, dynamic>>()
          .map(PaymentIntent.fromJson)
          .toList();
      if (loanId == null) return payments;
      return payments.where((p) => p.loanId == loanId).toList();
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    }
  }
}

// ── DI ──

final paymentsRepositoryProvider = Provider<PaymentsRepository>(
  (ref) => ApiPaymentsRepository(ref.watch(apiClientProvider)),
);

/// The signed-in user's payments, for the receipts screen.
final paymentReceiptsProvider = FutureProvider.autoDispose<List<PaymentIntent>>(
  (ref) => ref.watch(paymentsRepositoryProvider).receipts(),
);

/// One intent, kept live while the pay sheet polls it.
final paymentStatusProvider =
    FutureProvider.autoDispose.family<PaymentIntent, String>(
      (ref, id) => ref.watch(paymentsRepositoryProvider).status(id),
    );
