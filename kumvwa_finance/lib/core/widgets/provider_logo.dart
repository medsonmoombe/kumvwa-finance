import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/domain/pay_provider.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';

/// Brand data for a rail. Presentation only — the enum itself and its API
/// wire values live in `core/domain/pay_provider.dart` so the payments feature
/// can share them without importing a widget.
extension PayProviderBrand on PayProvider {
  String get logoUrl => switch (this) {
    PayProvider.airtelMoney => 'https://logo.clearbit.com/airtel.com',
    PayProvider.mtnMomo => 'https://logo.clearbit.com/mtn.com',
    PayProvider.zamtelKwacha => 'https://logo.clearbit.com/zamtel.co.zm',
    PayProvider.bank => 'https://logo.clearbit.com/absa.co.zm',
  };

  Color get fallbackColor => switch (this) {
    PayProvider.airtelMoney => const Color(0xFFE40000),
    PayProvider.mtnMomo => const Color(0xFFFFCB05),
    PayProvider.zamtelKwacha => const Color(0xFF00954C),
    PayProvider.bank => const Color(0xFF1A4FBF),
  };

  /// Short form for the fallback tile, where the full name would not fit.
  String get fallbackLabel => switch (this) {
    PayProvider.airtelMoney => 'Airtel',
    PayProvider.mtnMomo => 'MTN',
    PayProvider.zamtelKwacha => 'Zamtel',
    PayProvider.bank => 'Bank',
  };

  Color get fallbackTextColor => switch (this) {
    // MTN's brand yellow is too light to read white on.
    PayProvider.mtnMomo => const Color(0xFF00578E),
    _ => Colors.white,
  };
}

/// Brand mark tile: loads the provider logo over the network on a white base
/// (logos are designed for white), with a branded fallback tile and a quiet
/// loading state. Used on payment-method tiles and headers.
class ProviderLogo extends StatelessWidget {
  const ProviderLogo({super.key, required this.provider, this.size = 42});

  final PayProvider provider;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(size * 0.26),
        border: Border.all(color: AppColors.line),
      ),
      clipBehavior: Clip.antiAlias,
      child: Image.network(
        provider.logoUrl,
        fit: BoxFit.contain,
        errorBuilder: (_, _, _) => _FallbackTile(provider: provider),
        loadingBuilder: (context, child, progress) =>
            progress == null ? child : _LoadingTile(size: size),
      ),
    );
  }
}

class _FallbackTile extends StatelessWidget {
  const _FallbackTile({required this.provider});

  final PayProvider provider;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: provider.fallbackColor,
      alignment: Alignment.center,
      padding: const EdgeInsets.symmetric(horizontal: 3),
      child: Text(
        provider.fallbackLabel,
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: provider.fallbackTextColor,
          height: 1.05,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}

class _LoadingTile extends StatelessWidget {
  const _LoadingTile({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.bg,
      alignment: Alignment.center,
      child: SizedBox(
        width: size * 0.3,
        height: size * 0.3,
        child: const CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.muted,
        ),
      ),
    );
  }
}
