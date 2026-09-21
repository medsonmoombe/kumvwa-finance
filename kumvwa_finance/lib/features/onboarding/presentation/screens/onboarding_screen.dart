import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/app_checkbox.dart';
import 'package:kumvwa_finance/features/onboarding/domain/onboarding_controller.dart';
import 'package:kumvwa_finance/features/onboarding/domain/user_role.dart';

class OnboardingScreen extends ConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(onboardingControllerProvider);
    final controller = ref.read(onboardingControllerProvider.notifier);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ---------- scrollable content ----------
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 6, 20, 18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Hero(),
                    const SizedBox(height: 16),
                    _TermsRow(
                      accepted: state.termsAccepted,
                      onChanged: (_) => controller.toggleTerms(),
                    ),
                    const SizedBox(height: 16),
                    _RoleCard(
                      selected: state.role == UserRole.business,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        controller.selectRole(UserRole.business);
                      },
                      icon: Icons.business_center_outlined,
                      iconColor: AppColors.blue600,
                      iconBg: Colors.white,
                      title: 'Business (Lender)',
                      subtitle:
                          'For SACCOs, MFIs & licensed individual lenders',
                    ),
                    const SizedBox(height: 6),
                    const Center(
                      child: AppBadge(
                        'Requires valid BOZ registration',
                        variant: BadgeVariant.blue,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _RoleCard(
                      selected: state.role == UserRole.client,
                      onTap: () {
                        HapticFeedback.selectionClick();
                        controller.selectRole(UserRole.client);
                      },
                      icon: Icons.person_outline,
                      iconColor: AppColors.green700,
                      iconBg: AppColors.green50,
                      title: 'Client (Borrower)',
                      subtitle: 'Join using the invite link from your lender',
                    ),
                  ],
                ),
              ),
            ),
            // ---------- pinned CTA ----------
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: ElevatedButton(
                onPressed: state.termsAccepted
                    ? () => _continue(context, ref)
                    : null,
                child: const Text('Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _continue(BuildContext context, WidgetRef ref) {
    final role = ref.read(onboardingControllerProvider).role;
    context.go(
      role == UserRole.business ? '/register/business' : '/register/client',
    );
  }
}

// ---------- hero gradient card ----------

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: Container(
        height: 126,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.blue600, AppColors.blue900],
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -36,
              top: -36,
              child: _circle(140, AppColors.green500.withValues(alpha: .22)),
            ),
            Positioned(
              right: 24,
              bottom: -34,
              child: _circle(86, Colors.white.withValues(alpha: .08)),
            ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Lend smarter.\nGet paid on time.',
                  style: AppText.pageTitle.copyWith(
                    color: Colors.white,
                    height: 1.32,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Loan management for Zambian lenders, SACCOs & MFIs',
                  style: AppText.subText.copyWith(
                    color: const Color(0xFFBFD0F2),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _circle(double size, Color color) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

// ---------- terms row ----------

class _TermsRow extends StatelessWidget {
  const _TermsRow({required this.accepted, required this.onChanged});

  final bool accepted;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    const linkStyle = TextStyle(
      fontSize: 13,
      color: AppColors.blue600,
      fontWeight: FontWeight.w700,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppCheckbox(checked: accepted, onChanged: onChanged),
        const SizedBox(width: 9),
        Expanded(
          child: Text.rich(
            TextSpan(
              text: 'I agree to the ',
              style: AppText.subText.copyWith(
                color: AppColors.ink2,
                height: 1.5,
              ),
              children: [
                const TextSpan(text: 'Terms of Service', style: linkStyle),
                const TextSpan(text: ' and '),
                const TextSpan(text: 'Privacy Policy', style: linkStyle),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ---------- selectable role card ----------

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.selected,
    required this.onTap,
    required this.icon,
    required this.iconColor,
    required this.iconBg,
    required this.title,
    required this.subtitle,
  });

  final bool selected;
  final VoidCallback onTap;
  final IconData icon;
  final Color iconColor;
  final Color iconBg;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: selected ? AppColors.blue50 : AppColors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: selected ? AppColors.blue600 : AppColors.line,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: iconBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppText.body.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppText.subText.copyWith(height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _RadioDot(selected: selected),
          ],
        ),
      ),
    );
  }
}

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 19,
      height: 19,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? Colors.white : Colors.transparent,
        border: Border.all(
          color: selected ? AppColors.blue600 : const Color(0xFFC9D2E4),
          width: 2,
        ),
      ),
      child: selected
          ? Center(
              child: Container(
                width: 7,
                height: 7,
                decoration: const BoxDecoration(
                  color: AppColors.blue600,
                  shape: BoxShape.circle,
                ),
              ),
            )
          : null,
    );
  }
}
