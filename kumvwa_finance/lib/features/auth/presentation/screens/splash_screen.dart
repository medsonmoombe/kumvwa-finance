import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.card,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 26),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(height: constraints.maxHeight * 0.04),

                      // ── illustration ───────────────────────────────
                      SvgPicture.asset(
                        'assets/images/splash_screen.svg',
                        height: constraints.maxHeight * 0.38,
                        fit: BoxFit.contain,
                        semanticsLabel: 'Kumvwa Finance illustration',
                      ),

                      SizedBox(height: constraints.maxHeight * 0.03),

                      // ── copy ───────────────────────────────────────
                      Text(
                        'Lending, made simple.',
                        textAlign: TextAlign.center,
                        style: AppText.splashTitle,
                      ),
                      const SizedBox(height: 6),
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

                      SizedBox(height: constraints.maxHeight * 0.04),

                      // ── CTAs ───────────────────────────────────────
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
    );
  }
}
