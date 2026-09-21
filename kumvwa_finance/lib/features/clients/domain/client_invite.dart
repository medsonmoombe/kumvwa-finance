/// An invite sent by a business to a borrower, letting them complete
/// their own profile via a link.
class ClientInvite {
  ClientInvite({
    required this.token,
    required this.businessName,
    required this.clientName,
    required this.phone,
    this.completed = false,
  });

  final String token;
  final String businessName;
  final String clientName;
  final String phone;
  bool completed;
}

/// Thrown when an invite token is unknown/expired.
/// Message is safe to show to users.
class InviteException implements Exception {
  const InviteException(this.message);

  final String message;

  @override
  String toString() => message;
}
