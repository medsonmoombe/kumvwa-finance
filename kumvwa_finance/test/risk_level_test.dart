import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/risk_level.dart';

void main() {
  group('RiskLevelX.fromScore', () {
    test('bands 700 and above as low risk', () {
      expect(RiskLevelX.fromScore(700), RiskLevel.low);
      expect(RiskLevelX.fromScore(742), RiskLevel.low);
      expect(RiskLevelX.fromScore(850), RiskLevel.low);
    });

    test('bands 550–699 as medium risk', () {
      expect(RiskLevelX.fromScore(550), RiskLevel.medium);
      expect(RiskLevelX.fromScore(699), RiskLevel.medium);
    });

    test('bands anything below 550 as high risk', () {
      expect(RiskLevelX.fromScore(549), RiskLevel.high);
      expect(RiskLevelX.fromScore(300), RiskLevel.high);
      expect(RiskLevelX.fromScore(0), RiskLevel.high);
    });
  });

  group('RiskLevelX.label', () {
    test('names each band', () {
      expect(RiskLevel.low.label, 'Low risk');
      expect(RiskLevel.medium.label, 'Medium');
      expect(RiskLevel.high.label, 'High risk');
    });
  });
}
