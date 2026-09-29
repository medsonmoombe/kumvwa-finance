import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_card.dart';
import 'package:kumvwa_finance/core/widgets/app_field.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';
import 'package:kumvwa_finance/core/widgets/illustration.dart';
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
  }

  @override
  Widget build(BuildContext context) {
    final auth = ref.watch(authControllerProvider);
    final isSubmitting = auth.isSubmitting;

    return Scaffold(
      backgroundColor: AppColors.card,
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: EdgeInsets.zero,
            children: [
              // ── dome scrolls with content ─────────────────────────────
              _DomeWithMascot(onBack: () => context.go('/splash')),

              // ── form body ────────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppInsets.form,
                  28,
                  AppInsets.form,
                  24,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _PhoneField(
                      controller: _phoneCtrl,
                      enabled: !isSubmitting,
                    ),
                    const SizedBox(height: 12),
                    AppField(
                      label: 'Password',
                      controller: _passwordCtrl,
                      obscure: true,
                      textInputAction: TextInputAction.done,
                      enabled: !isSubmitting,
                      onSubmitted: (_) => _submit(),
                      formFieldKey: const ValueKey('password'),
                      validator: Validators.password,
                    ),
                    if (auth.errorMessage != null) ...[
                      const SizedBox(height: 14),
                      NoticeBanner(
                        message: auth.errorMessage!,
                        tone: TileTone.red,
                        title: 'Could not sign in',
                      ),
                    ],
                    const SizedBox(height: 22),
                    AppButton(
                      label: 'Sign In',
                      onPressed: _submit,
                      busy: isSubmitting,
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 4,
                      children: [
                        Text(
                          'New to Kumvwa?',
                          style: AppText.paragraph.copyWith(color: AppColors.muted),
                        ),
                        GestureDetector(
                          onTap: () => context.go('/register/client'),
                          child: Text(
                            'Create an account',
                            style: AppText.paragraph.copyWith(
                              color: AppColors.blue500,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      alignment: WrapAlignment.center,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: 4,
                      children: [
                        Text(
                          'Registering a lending institution?',
                          style: AppText.paragraph.copyWith(color: AppColors.muted),
                        ),
                        GestureDetector(
                            onTap: () => context.go('/login/lender'),
                            child: Text(
                              'Sign in as a lender or staff member',
                            style: AppText.paragraph.copyWith(
                              color: AppColors.blue500,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                      const SizedBox(height: 8),
                      Center(child: GestureDetector(onTap: () => context.go('/register/lender'), child: Text('New lending institution? Register here', style: AppText.fine.copyWith(color: AppColors.blue500, fontWeight: FontWeight.w700)))),
                    if (Env.isDev) ...[
                      const SizedBox(height: 20),
                      AppCard(
                        padding: const EdgeInsets.all(11),
                        tone: TileTone.blue,
                        child: Text(
                          Env.useMocks
                              ? 'Dev · mock credentials\n0971234567 · kumvwa123'
                              : 'Connected to ${Env.apiBaseUrl}',
                          textAlign: TextAlign.center,
                          style: AppText.paragraph.copyWith(
                            color: AppColors.blue600,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Dome header with the mascot peeking over its bottom-right edge.
///
/// The dome is placed in a [Stack] that adds bottom padding equal to the
/// mascot overhang, so the Column child below starts at the right offset
/// without needing IntrinsicHeight (which breaks LayoutBuilder constraints).
class _DomeWithMascot extends StatelessWidget {
  const _DomeWithMascot({required this.onBack});

  final VoidCallback onBack;

  // How far the mascot extends below the dome's painted bottom edge.
  static const double _mascotBelow = 50.0;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Extra bottom padding reserves layout space for the mascot overhang
        // so the Column child below starts at the right Y offset.
        Padding(
          padding: const EdgeInsets.only(bottom: _mascotBelow),
          child: SizedBox(
            width: double.infinity,
            child: DomeHeader(
              // Taller bottom padding = deeper dome
              padding: const EdgeInsets.fromLTRB(22, 18, 22, 88),
              child: DomeTitle(
                title: 'Welcome back',
                subtitle: 'Sign in to your Kumvwa account',
                onBack: onBack,
              ),
            ),
          ),
        ),

      ],
    );
  }
}

/// Phone number field with a locked +260 (Zambia) country prefix.
class _PhoneField extends StatefulWidget {
  const _PhoneField({required this.controller, required this.enabled});

  final TextEditingController controller;
  final bool enabled;

  @override
  State<_PhoneField> createState() => _PhoneFieldState();
}

class _PhoneFieldState extends State<_PhoneField> {
  final _focus = FocusNode();
  bool _focused = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (mounted) setState(() => _focused = _focus.hasFocus);
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  String? _validate(String? v) {
    final err = Validators.zmPhone(widget.controller.text);
    setState(() => _error = err);
    return err;
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      key: const ValueKey('phone'),
      validator: _validate,
      builder: (state) {
        final err = _error ?? (state.hasError ? state.errorText : null);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Phone number', style: AppText.fieldLabel),
            const SizedBox(height: 6),
            AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              height: AppSizes.field,
              decoration: BoxDecoration(
                color: err != null ? const Color(0xFFFFF7F7) : Colors.white,
                borderRadius: BorderRadius.circular(AppRadii.input),
                border: Border.all(
                  color: err != null ? AppColors.redInk : AppColors.line2,
                  width: 1.5,
                ),
              ),
              child: Row(
                children: [
                  Container(
                    height: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 13),
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(AppRadii.input - 1.5),
                        bottomLeft: Radius.circular(AppRadii.input - 1.5),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text('🇿🇲', style: TextStyle(fontSize: 14)),
                        const SizedBox(width: 5),
                        Text(
                          '+260',
                          style: AppText.fieldLabelSm.copyWith(
                            color: AppColors.ink2,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: TextField(
                        controller: widget.controller,
                        focusNode: _focus,
                        enabled: widget.enabled,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(9),
                        ],
                        cursorColor: AppColors.blue500,
                        cursorWidth: 1.5,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.ink,
                        ),
                        decoration: const InputDecoration(
                          isDense: true,
                          filled: true,
                          fillColor: Colors.white,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          errorBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                          hintText: '97 000 0000',
                          hintStyle: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                            color: AppColors.muted,
                          ),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
                    ),
                  ),
                  if (err != null)
                    const Padding(
                      padding: EdgeInsets.only(right: 12),
                      child: Icon(
                        Icons.error_outline_rounded,
                        size: 15,
                        color: AppColors.redInk,
                      ),
                    ),
                ],
              ),
            ),
            if (err != null) ...[
              const SizedBox(height: 5),
              Text(err, style: AppText.fieldError),
            ],
          ],
        );
      },
    );
  }
}
