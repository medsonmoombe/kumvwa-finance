import 'package:dio/dio.dart';

/// A failed request, with the server's message when one exists.
/// `message` is safe to show directly to the user.
class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  /// Nest's default error body: `{ statusCode, message, error }` where
  /// `message` is a `string[]` for validation failures or a single string
  /// for HttpExceptions (401/403/404/409/429…).
  factory ApiException.fromDio(DioException error) {
    final response = error.response;
    final data = response?.data;

    if (data is Map<String, dynamic>) {
      final raw = data['message'];
      final status = data['statusCode'];
      if (raw is List && raw.isNotEmpty) {
        return ApiException(raw.join('\n'), statusCode: _status(status));
      }
      if (raw is String && raw.isNotEmpty) {
        return ApiException(raw, statusCode: _status(status));
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