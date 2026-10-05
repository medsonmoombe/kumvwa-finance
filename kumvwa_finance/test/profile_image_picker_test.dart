import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kumvwa_finance/core/widgets/profile_image_picker.dart';
import 'package:kumvwa_finance/features/auth/data/auth_repository.dart';
import 'package:kumvwa_finance/features/auth/domain/user_session.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

/// Never reaches the network: the widget only calls this when a presigned URL
/// has expired, which is exactly the path under test.
class _FakeAuthRepository implements AuthRepository {
  @override
  Future<UserSession?> restoreSession() async => null;
  @override
  Future<UserSession> login({
    required String phone,
    required String password,
  }) async => throw UnimplementedError();
  @override
  Future<LenderSignInResult> loginLender({
    required String email,
    required String password,
  }) async => throw UnimplementedError();
  @override
  Future<UserSession> verifyLenderOtp({
    required String preToken,
    required String code,
  }) async => throw UnimplementedError();
  @override
  Future<UserSession> redeemLenderAccessCode(String code) async =>
      throw UnimplementedError();
  @override
  Future<void> logout() async {}
  @override
  Future<UserSession?> refreshProfileImage() async => null;
}

/// The splash hold is a brand-animation delay, not behaviour under test, and it
/// would otherwise leave a pending timer behind.
Widget _host(String? url) => ProviderScope(
  overrides: [
    authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
    splashHoldDurationProvider.overrideWithValue(Duration.zero),
  ],
  child: MaterialApp(
    home: Scaffold(
      body: ProfileImagePicker(
        name: 'Mathews Mathews',
        uploadBasePath: '/files/client',
        imageUrl: url,
      ),
    ),
  ),
);

/// The URL the widget is actually trying to load, or null if it has fallen
/// back to initials.
String? _loadedUrl(WidgetTester tester) {
  final image = tester.widgetList<Image>(find.byType(Image)).firstOrNull;
  final provider = image?.image;
  return provider is NetworkImage ? provider.url : null;
}

void main() {
  testWidgets('picks up a photo that arrives after the first frame', (
    tester,
  ) async {
    // The regression: session.profileImageUrl is null on frame one and only
    // populated once /auth/me resolves, so a widget that never re-reads
    // widget.imageUrl sat on the initial forever.
    await tester.pumpWidget(_host(null));
    expect(find.byType(Image), findsNothing);

    await tester.pumpWidget(_host('https://cdn.test/photo.jpg'));
    await tester.pump();

    expect(
      _loadedUrl(tester),
      'https://cdn.test/photo.jpg',
      reason: 'the newly arrived URL must replace the initial',
    );
  });

  testWidgets('keeps showing the photo when the same URL re-arrives', (
    tester,
  ) async {
    await tester.pumpWidget(_host('https://cdn.test/a.jpg'));
    await tester.pumpWidget(_host('https://cdn.test/a.jpg'));
    await tester.pump();
    expect(_loadedUrl(tester), 'https://cdn.test/a.jpg');
  });

  testWidgets('shows the first letter of the name with no photo', (
    tester,
  ) async {
    await tester.pumpWidget(_host(null));
    expect(find.text('M'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('uppercases the initial', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authRepositoryProvider.overrideWithValue(_FakeAuthRepository()),
          splashHoldDurationProvider.overrideWithValue(Duration.zero),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: ProfileImagePicker(
              name: 'zambia',
              uploadBasePath: '/files/client',
            ),
          ),
        ),
      ),
    );
    expect(find.text('Z'), findsOneWidget);
  });
}