import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';

/// Which platform legal document to show. Matches the API's `kind`.
enum LegalDocumentKind {
  terms('terms', 'Terms of Service'),
  privacy('privacy', 'Privacy Policy');

  const LegalDocumentKind(this.wire, this.title);

  final String wire;
  final String title;

  static LegalDocumentKind parse(String v) =>
      values.firstWhere((k) => k.wire == v, orElse: () => LegalDocumentKind.terms);
}

class LegalDocument {
  const LegalDocument({
    required this.kind,
    required this.title,
    required this.version,
    required this.body,
    required this.publishedAt,
  });

  final LegalDocumentKind kind;
  final String title;
  final int version;
  final String body;
  final DateTime? publishedAt;

  factory LegalDocument.fromJson(Map<String, dynamic> j) => LegalDocument(
    kind: LegalDocumentKind.parse(j['kind'] as String? ?? 'terms'),
    title: j['title'] as String? ?? '',
    version: (j['version'] as num?)?.toInt() ?? 0,
    body: j['body'] as String? ?? '',
    publishedAt: DateTime.tryParse(j['publishedAt'] as String? ?? ''),
  );
}

abstract class LegalDocumentsRepository {
  Future<LegalDocument> load(LegalDocumentKind kind);
}

class ApiLegalDocumentsRepository implements LegalDocumentsRepository {
  ApiLegalDocumentsRepository(this._client);

  final ApiClient _client;

  /// Public endpoint — no bearer token, because these documents have to be
  /// readable before someone has an account (and by anyone checking what we
  /// publish). The API pins the version, so the text shown is the text that
  /// was in force when it was fetched.
  @override
  Future<LegalDocument> load(LegalDocumentKind kind) async {
    final res = await _client.getPublic('/terms/platform/${kind.wire}');
    final data = res.data;
    if (data is! Map) {
      throw StateError('Unexpected response for ${kind.wire}');
    }
    return LegalDocument.fromJson(Map<String, dynamic>.from(data));
  }
}

class MockLegalDocumentsRepository implements LegalDocumentsRepository {
  @override
  Future<LegalDocument> load(LegalDocumentKind kind) async => LegalDocument(
    kind: kind,
    title: kind.title,
    version: 1,
    body:
        'Kumvwa Finance ${kind.title}\n\nThis is placeholder copy used when the '
        'API is unreachable during development.',
    publishedAt: null,
  );
}

final legalDocumentsRepositoryProvider = Provider<LegalDocumentsRepository>(
  (ref) => ApiLegalDocumentsRepository(ref.watch(apiClientProvider)),
);

/// Deliberately not autoDispose: re-opening the document should not refetch
/// on every visit, and the text is versioned so it cannot go stale in a way
/// that matters within a session.
final legalDocumentProvider =
    FutureProvider.family<LegalDocument, LegalDocumentKind>((ref, kind) async {
      final repo = ref.watch(legalDocumentsRepositoryProvider);
      return repo.load(kind);
    });