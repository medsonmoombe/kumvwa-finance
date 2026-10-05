import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kumvwa_finance/core/widgets/danger_action_tile.dart';

ProviderScope _host(Widget child) =>
    ProviderScope(child: MaterialApp(home: Scaffold(body: child)));

void main() {
  testWidgets('asks before signing out', (tester) async {
    var confirmed = 0;
    await tester.pumpWidget(
      _host(
        DangerActionTile(
          label: 'Sign out',
          onConfirm: () async => confirmed++,
        ),
      ),
    );

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Sign out?'), findsOneWidget);
    expect(confirmed, 0, reason: 'must not sign out before confirming');

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(confirmed, 0, reason: 'cancelling must leave the session alone');
    expect(find.text('Sign out?'), findsNothing);
  });

  testWidgets('signs out once confirmed', (tester) async {
    var confirmed = 0;
    await tester.pumpWidget(
      _host(
        DangerActionTile(
          label: 'Sign out',
          onConfirm: () async => confirmed++,
        ),
      ),
    );

    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    // The dialog repeats the label, so take the last one (the action).
    await tester.tap(find.text('Sign out').last);
    await tester.pumpAndSettle();
    expect(confirmed, 1);
  });

  testWidgets('shows a description so the consequence is explicit', (
    tester,
  ) async {
    await tester.pumpWidget(
      _host(
        DangerActionTile(
          label: 'Sign out',
          description: 'You will need your phone number and password.',
          onConfirm: () async {},
        ),
      ),
    );
    expect(
      find.text('You will need your phone number and password.'),
      findsOneWidget,
    );
  });

  testWidgets('is announced as a button to screen readers', (tester) async {
    final handle = tester.ensureSemantics();
    await tester.pumpWidget(
      _host(DangerActionTile(label: 'Sign out', onConfirm: () async {})),
    );
    expect(find.bySemanticsLabel('Sign out'), findsOneWidget);
    handle.dispose();
  });

  testWidgets('uses a caller-supplied confirmation copy', (tester) async {
    await tester.pumpWidget(
      _host(
        DangerActionTile(
          label: 'Sign out',
          confirmTitle: 'Leave this workspace?',
          confirmBody: 'Staff access ends immediately.',
          onConfirm: () async {},
        ),
      ),
    );
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Leave this workspace?'), findsOneWidget);
    expect(find.text('Staff access ends immediately.'), findsOneWidget);
  });
}