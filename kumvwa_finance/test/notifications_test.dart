import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/notifications/data/notifications_repository.dart';
import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';

void main() {
  late ProviderContainer container;

  setUp(() {
    // The default provider now points at the live API; these tests exercise
    // the repository CONTRACT against the in-memory mock.
    container = ProviderContainer(
      overrides: [
        notificationsRepositoryProvider.overrideWithValue(
          MockNotificationsRepository(),
        ),
      ],
    );
    addTearDown(container.dispose);
  });

  group('MockNotificationsRepository', () {
    test('seeds the business feed with unread items', () async {
      final items = await container
          .read(notificationsRepositoryProvider)
          .load(role: 'business');

      expect(items, hasLength(4));
      expect(items.where((n) => !n.read), hasLength(3));
      // The newest item is the loan-request alert.
      expect(items.first.type, NotificationType.loanRequest);
    });

    test('seeds the client feed with unread items', () async {
      final items = await container
          .read(notificationsRepositoryProvider)
          .load(role: 'client');

      expect(items, hasLength(4));
      expect(items.where((n) => !n.read), hasLength(2));
    });

    test('the two role feeds are independent', () async {
      final repo = container.read(notificationsRepositoryProvider);
      final business = await repo.load(role: 'business');
      final client = await repo.load(role: 'client');

      expect(
        business
            .map((n) => n.id)
            .toSet()
            .intersection(client.map((n) => n.id).toSet()),
        isEmpty,
      );
    });

    test('markAllRead marks every unread item for that role only', () async {
      final repo = container.read(notificationsRepositoryProvider);

      await repo.markAllRead(role: 'business');
      final business = await repo.load(role: 'business');
      final client = await repo.load(role: 'client');

      expect(business.every((n) => n.read), isTrue);
      // The client feed is untouched.
      expect(client.where((n) => !n.read), hasLength(2));
    });

    test(
      'load returns a copy — mutating it does not corrupt the store',
      () async {
        final repo = container.read(notificationsRepositoryProvider);
        final items = await repo.load(role: 'business');

        items.clear();

        final fresh = await repo.load(role: 'business');
        expect(fresh, hasLength(4));
      },
    );
  });

  group('notificationsProvider', () {
    test('resolves for the business role', () async {
      final items = await container.read(
        notificationsProvider('business').future,
      );

      expect(items, isNotEmpty);
    });

    test('resolves for the client role', () async {
      final items = await container.read(
        notificationsProvider('client').future,
      );

      expect(items, isNotEmpty);
    });
  });

  group('AppNotification.markRead', () {
    test('returns a read copy without mutating the original', () {
      final n = AppNotification(
        id: 'n1',
        title: 'Payment due',
        body: 'K 1,000 due on the 12th.',
        time: DateTime(2026, 9, 21, 9),
        type: NotificationType.paymentDue,
      );

      final read = n.markRead();

      expect(n.read, isFalse);
      expect(read.read, isTrue);
      expect(read.id, n.id);
      expect(read.title, n.title);
      expect(read.body, n.body);
      expect(read.time, n.time);
      expect(read.type, n.type);
    });
  });
}
