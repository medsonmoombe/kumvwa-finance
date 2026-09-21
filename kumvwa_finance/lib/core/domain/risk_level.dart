/// Credit risk band, shared across features.
enum RiskLevel { low, medium, high }

extension RiskLevelX on RiskLevel {
  String get label => switch (this) {
    RiskLevel.low => 'Low risk',
    RiskLevel.medium => 'Medium',
    RiskLevel.high => 'High risk',
  };

  /// Standard retail-score bands: ≥700 low, ≥550 medium, else high.
  static RiskLevel fromScore(int score) {
    if (score >= 700) return RiskLevel.low;
    if (score >= 550) return RiskLevel.medium;
    return RiskLevel.high;
  }
}
