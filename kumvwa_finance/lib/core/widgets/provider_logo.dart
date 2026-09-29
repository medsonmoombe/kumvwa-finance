import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';

enum PayProvider { airtel, mtn, zamtel, bank }

extension PayProviderX on PayProvider {
  String get label => switch (this) {
    PayProvider.airtel => 'Airtel Money',
    PayProvider.mtn => 'MTN MoMo',
    PayProvider.zamtel => 'Zamtel Kwacha',
    PayProvider.bank => 'Bank',
  };

  String get logoUrl => switch (this) {
    PayProvider.airtel => 'https://logo.clearbit.com/airtel.com',
    PayProvider.mtn => 'https://logo.clearbit.com/mtn.com',
    PayProvider.zamtel => 'https://logo.clearbit.com/zamtel.co.zm',
    PayProvider.bank => 'https://logo.clearbit.com/absa.co.zm',
  };

  Color get fallbackColor => switch (this) {
    PayProvider.airtel => const Color(0xFFE40000),
    PayProvider.mtn => const Color(0xFFFFCB05),
    PayProvider.zamtel => const Color(0xFF00954C),
    PayProvider.bank => const Color(0xFF1A4FBF),
  };

  String get fallbackLabel => switch (this) {
    PayProvider.airtel => 'Airtel',
    PayProvider.mtn => 'MTN',
    PayProvider.zamtel => 'Zamtel',
    PayProvider.bank => 'Bank',
  };

  Color get fallbackTextColor => switch (this) {
    PayProvider.mtn => const Color(0xFF00578E),
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
