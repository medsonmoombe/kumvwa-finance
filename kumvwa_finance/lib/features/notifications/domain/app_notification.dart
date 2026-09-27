/// Kind of notification — drives the tile icon and colour. Mirrors the
/// API's `NotificationType` enum (snake_case over the wire).
enum NotificationType {
  paymentDue,
  paymentReceived,
  loanOverdue,
  verification,
  clientActivity,
  loanRequest,
  requestApproved,
  requestRejected,
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
    this.data = const {},
  });

  final String id;
  final String title;
  final String body;
  final DateTime time;
  final NotificationType type;
  final bool read;

  /// Server-supplied deep-link payload, for example `{loanId: ...}` or
  /// `{requestId: ...}`. It lets a notification open the exact event detail.
  final Map<String, dynamic> data;

  AppNotification markRead() => AppNotification(
    id: id,
    title: title,
    body: body,
    time: time,
    type: type,
    read: true,
    data: data,
  );
}
