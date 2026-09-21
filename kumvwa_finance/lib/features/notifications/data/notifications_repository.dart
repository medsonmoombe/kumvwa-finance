import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/features/notifications/domain/app_notification.dart';

abstract class NotificationsRepository {
  Future<List<AppNotification>> load({required String role});
  Future<void> markAllRead({required String role});
}

/// In-memory mock, seeded per role. Swap for API + FCM push later.
class MockNotificationsRepository implements NotificationsRepository {
  final _business = <AppNotification>[
    AppNotification(
      id: 'n_b0',
      title: 'New loan request',
      body: 'Mwansa Bwalya requested K 4,000 over 3 months. '
          'Review it in Loan Requests.',
      time: DateTime.now().subtract(const Duration(hours: 5)),
      type: NotificationType.loanRequest,
    ),
    AppNotification(
      id: 'n_b1',
      title: 'Payment overdue',
      body: 'Chanda Nkhoma missed the installment due 28 Jul (K 1,650).',
      time: DateTime.now().subtract(const Duration(hours: 2)),
      type: NotificationType.paymentDue,
    ),
    AppNotification(
      id: 'n_b2',
      title: 'Client profile completed',
      body: 'Bupe Chilufya completed their borrower profile.',
      time: DateTime.now().subtract(const Duration(hours: 9)),
      type: NotificationType.clientActivity,
    ),
    AppNotification(
      id: 'n_b3',
      title: 'BOZ verification approved ✅',
      body: 'Your business account is fully active.',
      time: DateTime.now().subtract(const Duration(days: 3)),
      type: NotificationType.verification,
      read: true,
    ),
  ];

  final _client = <AppNotification>[
    AppNotification(
      id: 'n_c0',
      title: 'Loan request declined',
      body: 'Zamuka Savings & Credit declined your K 6,000 request. '
          'Open My Loans → My loan requests to read their feedback.',
      time: DateTime.now().subtract(const Duration(days: 5)),
      type: NotificationType.loanRequest,
    ),
    AppNotification(
      id: 'n_c1',
      title: 'Payment due in 3 days',
      body: 'Chilenje Community SACCO — K 3,267 due on the 12th.',
      time: DateTime.now().subtract(const Duration(hours: 1)),
      type: NotificationType.paymentDue,
    ),
    AppNotification(
      id: 'n_c2',
      title: 'Payment received ✅',
      body: 'We received your K 3,267 payment to Chilenje Community SACCO.',
      time: DateTime.now().subtract(const Duration(days: 1)),
      type: NotificationType.paymentReceived,
      read: true,
    ),
    AppNotification(
      id: 'n_c3',
      title: 'Welcome to Kumvwa Finance',
      body: 'Your borrower profile is complete. Track all your loans here.',
      time: DateTime.now().subtract(const Duration(days: 5)),
      type: NotificationType.system,
      read: true,
    ),
  ];

  @override
  Future<List<AppNotification>> load({required String role}) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    return List.of(role == 'client' ? _client : _business);
  }

  @override
  Future<void> markAllRead({required String role}) async {
    void mark(List<AppNotification> list) {
      for (var i = 0; i < list.length; i++) {
        if (!list[i].read) list[i] = list[i].markRead();
      }
    }

    mark(role == 'client' ? _client : _business);
  }
}

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => MockNotificationsRepository(),
);

final notificationsProvider = FutureProvider.autoDispose
    .family<List<AppNotification>, String>(
  (ref, role) => ref.watch(notificationsRepositoryProvider).load(role: role),
);
