/// An invite minted by a lender, claimed in the mobile app by typing the
/// short code (e.g. `KMV-7XQ4P`).
class ClientInvite {
  ClientInvite({
    required this.code,
    required this.businessName,
    required this.clientName,
    required this.phone,
    this.phoneMasked,
    this.link,
    this.primaryColor = '#1A4FBF',
    this.logoUrl,
    this.tagline,
    this.completed = false,
  });

  /// Short human-typeable code (`KMV-XXXXX`).
  final String code;
  final String businessName;
  final String clientName;

  /// Lender-side views get the full phone; the public lookup only ever
  /// receives a masked form (`••••• 1353`).
  final String phone;
  final String? phoneMasked;

  /// App download page — paired with [code] so the share card carries both
  /// "go get the app" and "redeem this in-app".
  final String? link;

  /// The inviting lender's white-label, straight off the public invite lookup:
  /// the colour their surfaces tint to, the tagline under their name, and a
  /// short-lived presigned URL for their uploaded logo. Null [logoUrl] means
  /// the invite screen falls back to their initials on [primaryColor].
  final String primaryColor;
  final String? logoUrl;
  final String? tagline;

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
