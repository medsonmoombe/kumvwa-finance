import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/illustration.dart';

class RoleSelectScreen extends StatelessWidget {
  const RoleSelectScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DomeHeader(
              small: true,
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 36),
              child: DomeTitle(
                title: 'Create account',
                subtitle: "Choose how you'll use Kumvwa",
                onBack: () => context.go('/splash'),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 24, 18, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _RoleCard(
                    title: "I'm a Borrower",
                    subtitle:
                        'Request loans, repay in chunks, grow your limit as you repay.',
                    icon: _BorrowerIcon(),
                    onTap: () => context.go('/register/client/borrower'),
                  ),
                  const SizedBox(height: 12),
                  _RoleCard(
                    title: "I'm a Lender",
                    subtitle:
                        'Register your institution with documents, approve loans, manage repayments.',
                    icon: _LenderIcon(),
                    onTap: () => context.go('/register/lender'),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'You can add the other role later from your profile.',
                    textAlign: TextAlign.center,
                    style: AppText.fine,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final Widget icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadii.chooser),
          border: Border.all(color: AppColors.line, width: 1.5),
          boxShadow: AppShadows.sh2,
        ),
        child: Row(
          children: [
            icon,
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppText.chooserTitle),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: AppText.rowSub.copyWith(height: 1.5),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: AppColors.muted,
            ),
          ],
        ),
      ),
    );
  }
}

class _BorrowerIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 62,
      height: 62,
      decoration: const BoxDecoration(
        color: AppColors.blue50,
        shape: BoxShape.circle,
      ),
      child: const Illustration(
        IllustrationAsset.mascot,
        width: 46,
        semanticLabel: '',
      ),
    );
  }
}

class _LenderIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 62,
      height: 62,
      decoration: const BoxDecoration(
        color: AppColors.green50,
        shape: BoxShape.circle,
      ),
      child: const Illustration(
        IllustrationAsset.bank,
        width: 52,
        semanticLabel: '',
      ),
    );
  }
}
