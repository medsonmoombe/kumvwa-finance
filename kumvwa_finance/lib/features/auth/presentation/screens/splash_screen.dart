import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  /// Width of the lockup in the brand bar. Sized small on purpose — it should
  /// read as a mark on the screen, not as a header band. Only the width is
  /// given, so the art keeps its own ratio (~2.07:1 -> 120 x 58).
  static const double _logoWidth = 120;

  /// The lockup's box, so a test can pin where the brand mark sits.
  static const Key logoKey = Key('splash-lockup');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.card,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // ── brand bar ───────────────────────────────────────────
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 16, 18, 12),
              child: Align(
                alignment: Alignment.centerLeft,
                child: _LockupBanner(key: logoKey, width: _logoWidth),
              ),
            ),

            // ── body ────────────────────────────────────────────────
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  return SingleChildScrollView(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: constraints.maxHeight,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 26),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SizedBox(height: constraints.maxHeight * 0.04),

                            // ── illustration ─────────────────────────
                            SvgPicture.asset(
                              'assets/images/splash_screen.svg',
                              height: constraints.maxHeight * 0.38,
                              fit: BoxFit.contain,
                              semanticsLabel: 'Kumvwa Finance illustration',
                            ),

                            SizedBox(height: constraints.maxHeight * 0.03),

                            // ── copy ─────────────────────────────────
                            Text(
                              'Lending, made simple.',
                              textAlign: TextAlign.center,
                              style: AppText.splashTitle,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Borrow from trusted lenders or run your entire '
                              'loan book — built for Zambia\'s SACCOs, MFIs '
                              'and licensed lenders.',
                              textAlign: TextAlign.center,
                              style: AppText.paragraph.copyWith(
                                color: AppColors.muted,
                                fontSize: 11,
                              ),
                            ),

                            SizedBox(height: constraints.maxHeight * 0.04),

                            // ── CTAs ─────────────────────────────────
                            AppButton(
                              label: 'Sign in',
                              onPressed: () => context.go('/login'),
                            ),
                            const SizedBox(height: 16),
                            GestureDetector(
                              onTap: () => context.go('/register/client'),
                              child: Text(
                                "Don't have an account? Register here",
                                textAlign: TextAlign.center,
                                style: AppText.paragraph.copyWith(
                                  color: AppColors.blue600,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            SizedBox(height: constraints.maxHeight * 0.03),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The Kumvwa Finance lockup, filling a [width]-wide corner box.
///
/// The asset is a 1600x900 sheet with the lockup inset — clear pixels on the
/// left and at the top — because it was exported on the same canvas as the
/// photographic version of the same art. Drawn whole it would float the wordmark
/// clear of the corner, so the sheet is drawn oversized inside a clip and
/// shifted up-left by exactly that inset: only the artwork is kept, and it lands
/// on the corner.
class _LockupBanner extends StatelessWidget {
  const _LockupBanner({super.key, required this.width});

  /// Width of the artwork on screen — not of the sheet it is cut from.
  final double width;

  static const String _asset = 'assets/brand/kumvwa_finance.png';

  /// The sheet's own size, and the box the artwork occupies inside it — both
  /// read off the asset's alpha channel, in sheet pixels.
  static const double _sheetWidth = 1600;
  static const double _sheetHeight = 900;
  static const Rect _artwork = Rect.fromLTRB(208, 214, 1129, 658);

  @override
  Widget build(BuildContext context) {
    final scale = width / _artwork.width;

    return ClipRect(
      child: SizedBox(
        width: width,
        height: _artwork.height * scale,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              left: -_artwork.left * scale,
              top: -_artwork.top * scale,
              child: Image.asset(
                _asset,
                width: _sheetWidth * scale,
                height: _sheetHeight * scale,
                semanticLabel: 'Kumvwa Finance',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
