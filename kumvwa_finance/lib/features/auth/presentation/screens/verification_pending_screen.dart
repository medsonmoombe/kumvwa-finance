import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_note.dart';
import 'package:kumvwa_finance/features/auth/presentation/business_registration_controller.dart';

class VerificationPendingScreen extends ConsumerWidget {
  const VerificationPendingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 60),
                    Container(
                      width: 76,
                      height: 76,
                      decoration: const BoxDecoration(
                        color: AppColors.green50,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_circle_outline,
                        size: 40,
                        color: AppColors.green700,
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      'Application submitted',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "We've received your business registration"
                      '. Our team is reviewing your documents.',
                      textAlign: TextAlign.center,
                      style: AppText.body.copyWith(
                        color: AppColors.ink2,
                        height: 1.55,
                      ),
                    ),
                    const SizedBox(height: 18),
                    AppNote(
                      child: Text(
                        'Verification usually takes 1–2 business days. '
                        "We'll send you an SMS once your account is approved.",
                        style: AppText.subText.copyWith(
                          color: const Color(0xFF7A5200),
                          height: 1.55,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              child: ElevatedButton(
                onPressed: () {
                  ref
                      .read(businessRegistrationControllerProvider.notifier)
                      .reset();
                  context.go('/onboarding');
                },
                child: const Text('Done'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
