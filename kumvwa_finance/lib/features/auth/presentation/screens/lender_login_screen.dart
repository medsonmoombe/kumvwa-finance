import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_field.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

class LenderLoginScreen extends ConsumerStatefulWidget {
  const LenderLoginScreen({super.key});

  @override
  ConsumerState<LenderLoginScreen> createState() => _LenderLoginScreenState();
}

class _LenderLoginScreenState extends ConsumerState<LenderLoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  final _accessCode = TextEditingController();
  String? _preToken;
  String? _devCode;
  bool _useAccessCode = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _code.dispose();
    _accessCode.dispose();
    super.dispose();
  }

  Future<void> _signIn() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final result = await ref.read(authControllerProvider.notifier).loginLender(_email.text, _password.text);
    if (!mounted || result == null) return;
    if (result.needsOtp) {
      setState(() { _preToken = result.preToken; _devCode = result.devCode; });
    }
  }

  Future<void> _verify() async {
    final token = _preToken;
    if (token == null || _code.text.trim().length != 6) return;
    await ref.read(authControllerProvider.notifier).verifyLenderOtp(token, _code.text.trim());
  }

  Future<void> _redeemAccessCode() async {
    final code = _accessCode.text.trim();
    if (code.isEmpty) return;
    await ref.read(authControllerProvider.notifier).redeemLenderAccessCode(code);
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final otpStage = _preToken != null;
    return Scaffold(
      backgroundColor: AppColors.card,
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DomeHeader(
              padding: const EdgeInsets.fromLTRB(22, 18, 22, 54),
              child: DomeTitle(
                title: otpStage
                    ? 'Check your inbox'
                    : _useAccessCode
                    ? 'Use access code'
                    : 'Sign in with your email',
                subtitle: otpStage
                    ? 'Enter the code sent to ${_email.text.trim()}'
                    : _useAccessCode
                    ? 'Enter the one-time code from your lender or platform administrator'
                    : 'Use the email and password on your existing account',
                onBack: () => otpStage ? setState(() => _preToken = null) : _useAccessCode ? setState(() => _useAccessCode = false) : context.go('/login'),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 28, 22, 28),
              child: otpStage ? _otpBody(auth) : _useAccessCode ? _accessCodeBody(auth) : _credentialsBody(auth),
            ),
          ],
        ),
      ),
    );
  }

  Widget _credentialsBody(AuthState auth) => Form(
    key: _formKey,
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const IconTile(tone: TileTone.blue, icon: Icons.business_rounded, size: 48),
      const SizedBox(height: 18),
      Text('Access your lender workspace', style: AppText.cardTitle.copyWith(fontSize: 18)),
      const SizedBox(height: 6),
      Text('Owners and staff sign in with the same email and password they use on Kumvwa Console.', style: AppText.paragraph.copyWith(color: AppColors.muted)),
      const SizedBox(height: 24),
      AppField(label: 'Email', controller: _email, keyboardType: TextInputType.emailAddress, validator: Validators.email, enabled: !auth.isSubmitting),
      const SizedBox(height: 14),
      AppField(label: 'Password', controller: _password, obscure: true, validator: Validators.password, enabled: !auth.isSubmitting, onSubmitted: (_) => _signIn()),
      if (auth.errorMessage != null) ...[const SizedBox(height: 14), _Error(message: auth.errorMessage!)],
      const SizedBox(height: 24),
      AppButton(label: 'Continue', onPressed: _signIn, busy: auth.isSubmitting, icon: Icons.arrow_forward_rounded),
      const SizedBox(height: 14),
      TextButton(onPressed: auth.isSubmitting ? null : () => setState(() => _useAccessCode = true), child: const Text('Use a one-time mobile access code')),
      const SizedBox(height: 4),
      Text('A one-time email code protects each new mobile device. Your organisation must be approved before lending features become available.', textAlign: TextAlign.center, style: AppText.fine),
    ]),
  );

  Widget _accessCodeBody(AuthState auth) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const IconTile(tone: TileTone.blue, icon: Icons.key_rounded, size: 48),
    const SizedBox(height: 18),
    Text('One-time mobile access', style: AppText.cardTitle.copyWith(fontSize: 18)),
    const SizedBox(height: 6),
    Text('Your lender owner or platform administrator can generate this secure code when email delivery is unavailable.', style: AppText.paragraph.copyWith(color: AppColors.muted)),
    const SizedBox(height: 24),
    AppField(label: 'Mobile access code', controller: _accessCode, maxLength: 23, textCapitalization: TextCapitalization.characters, validator: (v) => (v?.trim().length ?? 0) >= 16 ? null : 'Enter the access code', enabled: !auth.isSubmitting, onSubmitted: (_) => _redeemAccessCode()),
    if (auth.errorMessage != null) ...[const SizedBox(height: 14), _Error(message: auth.errorMessage!)],
    const SizedBox(height: 24),
    AppButton(label: 'Sign in with code', onPressed: _redeemAccessCode, busy: auth.isSubmitting, icon: Icons.lock_open_rounded),
    const SizedBox(height: 10),
    Text('Each code expires after 10 minutes and cannot be used again.', textAlign: TextAlign.center, style: AppText.fine),
  ]);

  Widget _otpBody(AuthState auth) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const IconTile(tone: TileTone.green, icon: Icons.mark_email_read_rounded, size: 48),
    const SizedBox(height: 18),
    Text('Verify this device', style: AppText.cardTitle.copyWith(fontSize: 18)),
    const SizedBox(height: 6),
    Text('Enter the six-digit sign-in code. This device will be remembered securely for 30 days.', style: AppText.paragraph.copyWith(color: AppColors.muted)),
    const SizedBox(height: 24),
    AppField(label: 'Sign-in code', controller: _code, keyboardType: TextInputType.number, maxLength: 6, validator: (v) => (v?.trim().length ?? 0) == 6 ? null : 'Enter the 6-digit code', enabled: !auth.isSubmitting, onSubmitted: (_) => _verify()),
    if (_devCode != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('Development code: $_devCode', style: AppText.fine.copyWith(color: AppColors.blue600))),
    if (auth.errorMessage != null) ...[const SizedBox(height: 14), _Error(message: auth.errorMessage!)],
    const SizedBox(height: 24),
    AppButton(label: 'Verify and sign in', onPressed: _verify, busy: auth.isSubmitting, icon: Icons.verified_rounded),
  ]);
}

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(color: AppColors.red50, borderRadius: BorderRadius.circular(12)),
    child: Text(message, style: AppText.paragraph.copyWith(color: AppColors.redInk)),
  );
}
