import 'package:dio/dio.dart';

/// A failed request, with the server's message when one exists.
/// `message` is safe to show directly to the user.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;

  /// The API's machine-readable error code, when it sent one — e.g.
  /// `CLIENT_LIMIT`, `BILLING_SUSPENDED`, `VALIDATION_ERROR`.
  ///
  /// This is kept alongside the message rather than parsed out of it, because a
  /// screen has to branch on *what* went wrong (offer to buy capacity, route to
  /// support) while showing the human message. Matching on message text would
  /// break the moment the copy is edited.
  final String? code;

  /// The client limit was reached: the caller has run out of paid client slots.
  ///
  /// Branch on the `code`, not the status. 402 only means "this lender is full"
  /// *because* the API always pairs that status with this code — and screens
  /// build specific, factual copy off this flag (a borrower is told to ask the
  /// lender for a place, not to go buy one). Keying off the bare status would
  /// let an unrelated future 402 inherit that claim.
  bool get isClientLimit => code == 'CLIENT_LIMIT';

  /// The tenant's subscription is hard-blocked. Buying slots will not help.
  bool get isBillingSuspended => code == 'BILLING_SUSPENDED';

  bool get isUnauthorized => statusCode == 401;

  /// Nest's default error body: `{ statusCode, message, error }` where
  /// `message` is a `string[]` for validation failures or a single string
  /// for HttpExceptions (401/403/404/409/429…).
  factory ApiException.fromDio(DioException error) {
    final response = error.response;
    final data = response?.data;

    if (data is Map<String, dynamic>) {
      final raw = data['message'];
      final status = data['statusCode'];
      final code = data['code'];
      final codeText = code is String && code.isNotEmpty ? code : null;

      if (raw is List && raw.isNotEmpty) {
        return ApiException(
          raw.join('\n'),
          statusCode: _status(status) ?? response?.statusCode,
          code: codeText,
        );
      }
      if (raw is String && raw.isNotEmpty) {
        return ApiException(
          raw,
          statusCode: _status(status) ?? response?.statusCode,
          code: codeText,
        );
      }
      // A body with a `code` but no message is still actionable — the branch
      // matters more than the wording.
      if (codeText != null) {
        return ApiException(
          'Request failed (${response?.statusCode ?? 'unknown'})',
          statusCode: _status(status) ?? response?.statusCode,
          code: codeText,
        );
      }
    }

    final fallback = switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout =>
        'Request timed out. Check your connection and try again.',
      DioExceptionType.connectionError =>
        'Cannot reach the server. Check your internet connection.',
      _ => 'Something went wrong. Please try again.',
    };
    return ApiException(fallback, statusCode: response?.statusCode);
  }

  static int? _status(dynamic value) => value is num ? value.toInt() : null;

  @override
  String toString() => message;
}

/// One line naming *why* a screen could not load, for the error state itself.
///
/// The friendly headline ('Could not load your account') hides the only useful
/// part — the status code and the server's own message, or the parse error when
/// the response shape is what broke. Rendering it small and muted turns a
/// screenshot of the app into a diagnosis instead of an unreproducible report.
String describeApiError(Object error) {
  if (error is ApiException) {
    return error.statusCode == null
        ? error.message
        : '${error.statusCode} · ${error.message}';
  }
  return error.toString();
}
