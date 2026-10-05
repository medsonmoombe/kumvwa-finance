import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_theme.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/features/legal/data/legal_documents_repository.dart';
import 'package:kumvwa_finance/features/legal/presentation/legal_document_screen.dart';

class _StubLegalRepo implements LegalDocumentsRepository {
  _StubLegalRepo(this.body);

  final String body;

  @override
  Future<LegalDocument> load(LegalDocumentKind kind) async => LegalDocument(
    kind: kind,
    title: kind.title,
    version: 1,
    body: body,
    publishedAt: DateTime(2026, 10, 4),
  );
}

Future<void> _pumpDocument(
  WidgetTester tester,
  String body, {
  Size surface = const Size(800, 900),
}) async {
  tester.view.physicalSize = surface;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        legalDocumentsRepositoryProvider.overrideWithValue(
          _StubLegalRepo(body),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const LegalDocumentScreen(kind: LegalDocumentKind.privacy),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  // The DomeScaffold delegate used to hand the header a loose width, so the
  // gradient shrank to its title's natural width and left the right-hand side
  // of the screen white — only visible on the privacy/terms screens, the sole
  // DomeScaffold users.
  testWidgets('the dome header spans the whole screen width', (tester) async {
    await _pumpDocument(
      tester,
      'KUMVWA FINANCE — PRIVACY POLICY\nVersion 1\n\nAn intro paragraph.',
    );

    expect(tester.takeException(), isNull);
    expect(tester.getSize(find.byType(DomeHeader)).width, 800);
  });

  // The API stores the copy hard-wrapped at ~80 columns; those wraps are not
  // paragraph breaks and must not be rendered as mid-sentence line breaks.
  testWidgets('hard-wrapped body lines reflow into one paragraph', (
    tester,
  ) async {
    await _pumpDocument(
      tester,
      'KUMVWA FINANCE — PRIVACY POLICY\nVersion 1\n\n'
      'This policy explains what personal data Kumvwa Finance collects, why, and what\n'
      'you can do about it. It applies to clients, lenders and their staff who use the\n'
      'platform under the Data Protection Act.',
    );

    expect(
      find.text(
        'This policy explains what personal data Kumvwa Finance collects, '
        'why, and what you can do about it. It applies to clients, lenders '
        'and their staff who use the platform under the Data Protection Act.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('a section body reflows but lettered items stay separate', (
    tester,
  ) async {
    await _pumpDocument(
      tester,
      'KUMVWA FINANCE — PRIVACY POLICY\nVersion 1\n\n'
      '2. DATA WE COLLECT\n'
      'a. Identity and contact data: name, national registration\n'
      '   number, phone number and email address.\n'
      'b. Account and security data: sign-in credentials\n'
      '   and device information.',
    );

    expect(find.text('DATA WE COLLECT'), findsOneWidget);
    expect(
      find.text(
        'a. Identity and contact data: name, national registration '
        'number, phone number and email address.',
      ),
      findsOneWidget,
    );
    expect(
      find.text(
        'b. Account and security data: sign-in credentials '
        'and device information.',
      ),
      findsOneWidget,
    );
  });
}
