import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/color_x.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';

/// tenantId → branding. Falls back to Kumvwa defaults for unknown lenders.
final lenderBrandingProvider = Provider<Map<String, LenderStatus>>((ref) {
  final gate = ref.watch(clientGateProvider).valueOrNull;
  return {
    for (final l in gate?.lenders ?? const <LenderStatus>[]) l.tenantId: l,
  };
});

/// Resolved branding for a lender surface: [gradient, solid, logoUrl].
/// Unknown/null tenantId → Kumvwa brand blue.
typedef LenderTheme = ({List<Color> gradient, Color solid, String? logoUrl});

LenderTheme lenderTheme(WidgetRef ref, String? tenantId) {
  final b = tenantId == null
      ? null
      : ref.watch(lenderBrandingProvider)[tenantId];
  final color = b?.primaryColor.toColor() ?? AppColors.blue600;
  return (gradient: [color, darken(color)], solid: color, logoUrl: b?.logoUrl);
}
