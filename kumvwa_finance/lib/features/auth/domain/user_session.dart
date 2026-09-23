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
  });

  final String token; // JWT once the real API exists
  final String userId;
  final String displayName;
  final String phone;
  final String role; // 'business' | 'client'

  /// Rotating refresh token (API-backed sessions). Null for mock sessions,
  /// so persisted mock data still loads.
  final String? refreshToken;

  /// Client-only: KYC wizard state. `profileComplete` gates the loan
  /// features; `profilePercent` drives the wizard's progress indicator.
  /// Lender accounts are always "complete".
  final bool profileComplete;
  final int profilePercent;

  bool get needsProfile => !profileComplete;

  UserSession copyWith({
    String? displayName,
    String? phone,
    String? role,
    bool? profileComplete,
    int? profilePercent,
  }) =>
      UserSession(
        token: token,
        userId: userId,
        displayName: displayName ?? this.displayName,
        phone: phone ?? this.phone,
        role: role ?? this.role,
        refreshToken: refreshToken,
        profileComplete: profileComplete ?? this.profileComplete,
        profilePercent: profilePercent ?? this.profilePercent,
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
      };

  factory UserSession.fromJson(Map<String, dynamic> json) => UserSession(
        token: json['token'] as String,
        userId: json['userId'] as String,
        displayName: json['displayName'] as String,
        phone: json['phone'] as String,
        role: json['role'] as String,
        refreshToken: json['refreshToken'] as String?,
        // Old persisted sessions predate these fields — treat as complete
        // so a stale cache never traps a lender on the wizard.
        profileComplete: json['profileComplete'] as bool? ?? true,
        profilePercent: json['profilePercent'] as int? ?? 100,
      );
}
