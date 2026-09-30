/// The signed-in identity. Stored as JSON in secure storage.
class UserSession {
  const UserSession({
    required this.token,
    required this.userId,
    required this.displayName,
    required this.phone,
    required this.role,
    this.refreshToken,
    this.profileComplete = true,
    this.profilePercent = 100,
    this.profileFileId,
    this.profileImageUrl,
  });

  final String token;
  final String userId;
  final String displayName;
  final String phone;
  final String role;
  final String? refreshToken;
  final bool profileComplete;
  final int profilePercent;

  /// Stable file ID — persisted to storage. Used to re-fetch a fresh
  /// presigned URL on every session restore (presigned URLs expire in 15 min).
  final String? profileFileId;

  /// Ephemeral presigned URL — never persisted, always re-fetched from /auth/me.
  final String? profileImageUrl;

  bool get needsProfile => !profileComplete;

  UserSession copyWith({
    String? displayName,
    String? phone,
    String? role,
    bool? profileComplete,
    int? profilePercent,
    String? profileFileId,
    String? profileImageUrl,
  }) => UserSession(
    token: token,
    userId: userId,
    displayName: displayName ?? this.displayName,
    phone: phone ?? this.phone,
    role: role ?? this.role,
    refreshToken: refreshToken,
    profileComplete: profileComplete ?? this.profileComplete,
    profilePercent: profilePercent ?? this.profilePercent,
    profileFileId: profileFileId ?? this.profileFileId,
    profileImageUrl: profileImageUrl ?? this.profileImageUrl,
  );

  Map<String, dynamic> toJson() => {
    'token': token,
    'userId': userId,
    'displayName': displayName,
    'phone': phone,
    'role': role,
    if (refreshToken != null) 'refreshToken': refreshToken,
    'profileComplete': profileComplete,
    'profilePercent': profilePercent,
    // profileFileId persisted — stable, never expires
    if (profileFileId != null) 'profileFileId': profileFileId,
    // profileImageUrl intentionally NOT persisted — it's a presigned URL
    // that expires in 15 min. It is re-fetched fresh from /auth/me on restore.
  };

  factory UserSession.fromJson(Map<String, dynamic> json) => UserSession(
    token: json['token'] as String,
    userId: json['userId'] as String,
    displayName: json['displayName'] as String,
    phone: json['phone'] as String,
    role: json['role'] as String,
    refreshToken: json['refreshToken'] as String?,
    profileComplete: json['profileComplete'] as bool? ?? true,
    profilePercent: json['profilePercent'] as int? ?? 100,
    profileFileId: json['profileFileId'] as String?,
    // profileImageUrl always starts null — re-populated by /auth/me
  );
}
