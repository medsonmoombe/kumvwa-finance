/// Kind of notification — drives the tile icon and colour.
enum NotificationType {
  paymentDue,
  paymentReceived,
  verification,
  clientActivity,
  loanRequest,
  system,
}

/// One entry in the notification center feed.
class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.time,
    required this.type,
    this.read = false,
  });

  final String id;
  final String title;
  final String body;
  final DateTime time;
  final NotificationType type;
  final bool read;

  AppNotification markRead() => AppNotification(
        id: id,
        title: title,
        body: body,
        time: time,
        type: type,
        read: true,
      );
}
