/// The signed-in identity. Stored as JSON in secure storage.
class UserSession {
  const UserSession({
    required this.token,
    required this.userId,
    required this.displayName,
    required this.phone,
    required this.role,
  });

  final String token; // JWT once the real API exists
  final String userId;
  final String displayName;
  final String phone;
  final String role; // 'business' | 'client'

  Map<String, dynamic> toJson() => {
    'token': token,
    'userId': userId,
    'displayName': displayName,
    'phone': phone,
    'role': role,
  };

  factory UserSession.fromJson(Map<String, dynamic> json) => UserSession(
    token: json['token'] as String,
    userId: json['userId'] as String,
    displayName: json['displayName'] as String,
    phone: json['phone'] as String,
    role: json['role'] as String,
  );
}
