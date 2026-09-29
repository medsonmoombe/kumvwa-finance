import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/brand_tile.dart';
import 'package:kumvwa_finance/core/widgets/illustration.dart';

/// Splash / landing screen.
///
/// Layout mirrors the HTML mockup exactly:
///   • Mini logo lockup top-left
///   • Illustrated scene (bank on blue disc + mascot character) filling ~250dp
///   • Copy block: headline, supporting line, primary CTA, ghost link
///
/// When the router is still restoring a saved session it redirects here and
/// the CTA buttons are hidden — the spinner is the only affordance. Once the
/// session resolves the redirect fires and the user never sees this screen
/// long enough to tap anything.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.card,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── mini logo ──────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
              child: Row(
                children: [
                  BrandTile(size: 34),
                  const SizedBox(width: 10),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Kumvwa',
                        style: AppText.navLabelOn.copyWith(
                          fontSize: 13,
                          color: AppColors.blue900,
                          letterSpacing: -0.2,
                          height: 1.15,
                        ),
                      ),
                      Text(
                        'FINANCE',
                        style: AppText.navLabelOn.copyWith(
                          fontSize: 6.5,
                          color: AppColors.muted,
                          letterSpacing: 3.0,
                          height: 1.15,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // ── illustrated scene ──────────────────────────────────────
            SizedBox(
              height: 250,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  // scene SVG (bank on blue disc with orbit + confetti)
                  Positioned.fill(
                    child: LayoutBuilder(
                      builder: (_, c) => Illustration(
                        IllustrationAsset.splashScene,
                        width: c.maxWidth,
                        semanticLabel: 'Kumvwa Finance illustration',
                      ),
                    ),
                  ),
                  // mascot character — bottom-left, hangs slightly below scene
                  Positioned(
                    left: 26,
                    bottom: -4,
                    child: Illustration(
                      IllustrationAsset.mascot,
                      width: 112,
                      semanticLabel: '',
                    ),
                  ),
                ],
              ),
            ),

            // ── copy + CTAs ────────────────────────────────────────────
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(26, 0, 26, 22),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Lending, made simple.',
                      textAlign: TextAlign.center,
                      style: AppText.splashTitle,
                    ),
                    const SizedBox(height: 7),
                    Text(
                      'Borrow from trusted lenders or run your entire loan '
                      'book — built for Zambia\'s SACCOs, MFIs and licensed '
                      'lenders.',
                      textAlign: TextAlign.center,
                      style: AppText.paragraph.copyWith(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 14),
                    AppButton(
                      label: 'Sign Up',
                      onPressed: () => context.go('/register/client'),
                    ),
                    const SizedBox(height: 4),
                    AppButton(
                      label: 'I already have an account',
                      tone: AppButtonTone.ghost,
                      onPressed: () => context.go('/login'),
                    ),
                    const SizedBox(height: 4),
                    GestureDetector(
                      onTap: () => context.go('/register/lender'),
                      child: Text(
                        'Register a lending institution →',
                        textAlign: TextAlign.center,
                        style: AppText.fine.copyWith(
                          color: AppColors.blue600,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
