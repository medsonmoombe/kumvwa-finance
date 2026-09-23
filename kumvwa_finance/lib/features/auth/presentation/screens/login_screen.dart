import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/app_phone_field.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/core/widgets/brand_logo.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phoneCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    ref
        .read(authControllerProvider.notifier)
        .login(_phoneCtrl.text, _passwordCtrl.text);
    // No context.go here — the router redirect fires when auth state flips.
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final isSubmitting = auth.isSubmitting;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 72),
                // The mark stands alone on login — "Welcome back" is the
                // hero text (wordmark stays on the splash).
                const Center(child: BrandMark(size: 84)),
                const SizedBox(height: 26),
                Text(
                  'Welcome back',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: AppColors.ink,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Log in to manage your loan portfolio',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, color: AppColors.muted),
                ),
                const SizedBox(height: 32),
                AppPhoneField(
                  label: 'Phone number',
                  controller: _phoneCtrl,
                  hint: '097 1234567',
                  enabled: !isSubmitting,
                  validator: (_) => Validators.zmPhone(_phoneCtrl.text),
                ),
                const SizedBox(height: 16),
                AppTextField(
                  label: 'Password',
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  enabled: !isSubmitting,
                  validator: Validators.password,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_off_outlined
                          : Icons.visibility_outlined,
                      size: 20,
                      color: AppColors.muted,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                ),
                if (auth.errorMessage != null) ...[
                  const SizedBox(height: 14),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.red50,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFF3C6C8)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline,
                            size: 18, color: AppColors.red),
                        const SizedBox(width: 9),
                        Expanded(
                          child: Text(
                            auth.errorMessage!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFFC03538),
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: isSubmitting ? null : _submit,
                  child: isSubmitting
                      ? const ButtonSpinner()
                      : const Text('Log In'),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'New to Kumvwa? ',
                      style: TextStyle(fontSize: 13, color: AppColors.muted),
                    ),
                    GestureDetector(
                      onTap: () => context.go('/register/client'),
                      child: const Text(
                        'Enter an invite code',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.blue600,
                        ),
                      ),
                    ),
                  ],
                ),
                // Dev-only banner: absent from release builds entirely.
                if (Env.isDev) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(11),
                    decoration: BoxDecoration(
                      color: AppColors.blue50,
                      borderRadius: BorderRadius.circular(11),
                    ),
                    child: Text(
                      Env.useMocks
                          ? 'Dev build — mock credentials\n'
                              'Lender: 0971234567 · kumvwa123\n'
                              'Client: 0971112233 · kumvwa123'
                          // Live mode: accounts come from real invites, so
                          // no credentials are printed here.
                          : 'Connected to Kumvwa API\n'
                              '${Env.apiBaseUrl}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppColors.blue600,
                        fontWeight: FontWeight.w600,
                        height: 1.5,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
