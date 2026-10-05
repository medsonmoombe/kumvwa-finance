import 'package:flutter_test/flutter_test.dart';
import 'package:kumvwa_finance/features/legal/data/legal_documents_repository.dart';

void main() {
  group('LegalDocumentKind', () {
    test('parses the wire values the API uses', () {
      expect(LegalDocumentKind.parse('terms'), LegalDocumentKind.terms);
      expect(LegalDocumentKind.parse('privacy'), LegalDocumentKind.privacy);
    });

    // An unknown value must not silently render the wrong document.
    test('falls back to terms rather than throwing', () {
      expect(LegalDocumentKind.parse('nonsense'), LegalDocumentKind.terms);
    });

    test('exposes a title for each document', () {
      expect(LegalDocumentKind.terms.title, 'Terms of Service');
      expect(LegalDocumentKind.privacy.title, 'Privacy Policy');
    });
  });

  group('LegalDocument.fromJson', () {
    test('reads every field the API returns', () {
      final doc = LegalDocument.fromJson({
        'kind': 'privacy',
        'title': 'Privacy Policy',
        'version': 3,
        'body': 'BODY',
        'publishedAt': '2026-10-04T09:00:00.000Z',
      });
      expect(doc.kind, LegalDocumentKind.privacy);
      expect(doc.version, 3);
      expect(doc.body, 'BODY');
      expect(doc.publishedAt, isNotNull);
    });

    // A missing optional field must not throw on an older payload.
    test('tolerates missing optional fields', () {
      final doc = LegalDocument.fromJson({'body': 'BODY'});
      expect(doc.kind, LegalDocumentKind.terms);
      expect(doc.version, 0);
      expect(doc.publishedAt, isNull);
      expect(doc.body, 'BODY');
    });

    test('treats a null body as empty rather than crashing', () {
      final doc = LegalDocument.fromJson({'body': null});
      expect(doc.body, isEmpty);
    });
  });

  test('mock repository returns a document for both kinds', () async {
    final repo = MockLegalDocumentsRepository();
    for (final kind in LegalDocumentKind.values) {
      final doc = await repo.load(kind);
      expect(doc.kind, kind);
      expect(doc.body, isNotEmpty);
    }
  });
}