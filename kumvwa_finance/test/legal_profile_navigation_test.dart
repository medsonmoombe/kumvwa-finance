import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/router/app_router.dart';
import 'package:kumvwa_finance/core/storage/token_store.dart';
import 'package:kumvwa_finance/core/theme/app_theme.dart';
import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/legal/data/legal_documents_repository.dart';
import 'package:kumvwa_finance/features/legal/presentation/legal_document_screen.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';

class _FakeAuthRepository implements AuthRepository {
  _FakeAuthRepository(this.role);

  final String role;

  @override
  Future<UserSession?> restoreSession() async => UserSession(
    token: 'test-jwt',
    userId: 'u_001',
    displayName: role == 'business' ? 'Chilenje Community SACCO' : 'Mwansa Bwalya',
    phone: '0971234567',
    role: role,
    profileComplete: true,
    profilePercent: 100,
  );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Answers the two calls the lender profile makes on load, so the test never
/// touches the network.
class _FakeApiClient extends ApiClient {
  _FakeApiClient() : super(tokenStore: TokenStore(), onSessionExpired: () {});

  @override
  Future<Response<dynamic>> getA(String path, {Map<String, dynamic>? query}) async {
    final data = switch (path) {
      '/tenants/me' => <String, dynamic>{
        'status': 'active',
        'businessDescription': null,
      },
      '/tenants/me/branding' => <String, dynamic>{'logoUrl': null},
      _ => <String, dynamic>{},
    };
    return Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: data,
      statusCode: 200,
    );
  }
}

Future<ProviderContainer> _pumpAt(
  WidgetTester tester,
  String location, {
  required String role,
}) async {
  tester.view.physicalSize = const Size(400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  final container = ProviderContainer(
    overrides: [
      splashHoldDurationProvider.overrideWithValue(Duration.zero),
      authRepositoryProvider.overrideWithValue(_FakeAuthRepository(role)),
      apiClientProvider.overrideWithValue(_FakeApiClient()),
      // Borrower-only gate; keep it pending so no request fires.
      clientGateProvider.overrideWith(
        (ref) => Completer<ClientGateState>().future,
      ),
      clientLoansProvider.overrideWith((ref) async => const []),
      legalDocumentsRepositoryProvider.overrideWithValue(
        MockLegalDocumentsRepository(),
      ),
    ],
  );
  addTearDown(container.dispose);

  final router = container.read(appRouterProvider);
  addTearDown(router.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.light(),
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 100));

  router.go(location);
  await tester.pumpAndSettle();
  return container;
}

/// Advances past a route transition without `pumpAndSettle`, which would wait
/// forever on a spinner the moment a document future has not resolved.
Future<void> _settleRoute(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(() {
    GoogleFonts.config.allowRuntimeFetching = false;
  });

  // Terms/Privacy live on the lender profile. Before the redirect fix they
  // were bounced back to `/lender/home` because `/legal/*` started with
  // neither `/c` nor `/lender`.
  testWidgets('lender profile Terms and Privacy open the right documents', (
    tester,
  ) async {
    final container = await _pumpAt(
      tester,
      '/lender/profile',
      role: 'business',
    );

    await tester.ensureVisible(find.text('Terms of Service'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Terms of Service'));
    await _settleRoute(tester);
    expect(
      tester.widget<LegalDocumentScreen>(find.byType(LegalDocumentScreen)).kind,
      LegalDocumentKind.terms,
    );

    container.read(appRouterProvider).pop();
    await _settleRoute(tester);

    await tester.ensureVisible(find.text('Privacy Policy'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Privacy Policy'));
    await _settleRoute(tester);
    expect(
      tester.widget<LegalDocumentScreen>(find.byType(LegalDocumentScreen)).kind,
      LegalDocumentKind.privacy,
    );
  });

  // The borrower surface must not offer them while they are lender-only.
  testWidgets('client profile no longer offers the legal documents', (
    tester,
  ) async {
    await _pumpAt(tester, '/c/profile', role: 'client');

    expect(find.text('Terms of Service'), findsNothing);
    expect(find.text('Privacy Policy'), findsNothing);
  });

  // The document is laid out as sections, not one preformatted wall of text,
  // and it must fit the narrowest phone the app supports without overflow.
  testWidgets('LegalDocumentScreen lays the document out as sections', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          legalDocumentsRepositoryProvider.overrideWithValue(_StubLegalRepo()),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const LegalDocumentScreen(kind: LegalDocumentKind.terms),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    // The masthead is dropped; the header names the document instead.
    expect(find.textContaining('KUMVWA FINANCE'), findsNothing);
    expect(find.text('Version 4'), findsOneWidget);
    // Numbered sections become headings; their bodies stay verbatim.
    expect(find.text('WHAT KUMVWA IS'), findsOneWidget);
    expect(find.text('Kumvwa is software.'), findsOneWidget);
    expect(find.text('Intro paragraph.'), findsOneWidget);
  });
}

class _StubLegalRepo implements LegalDocumentsRepository {
  @override
  Future<LegalDocument> load(LegalDocumentKind kind) async => LegalDocument(
    kind: kind,
    title: kind.title,
    version: 4,
    body:
        'KUMVWA FINANCE — PLATFORM TERMS OF SERVICE\nVersion 4\n\n'
        'Intro paragraph.\n\n'
        '1. WHAT KUMVWA IS\nKumvwa is software.\n\n'
        '2. LENDING DECISIONS\nThe lender decides.',
    publishedAt: DateTime(2026, 10, 4),
  );
}
