import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_checkbox.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

/// Account creation from an invite code (Option-A onboarding): the code
/// verifies WHO invited whom, this form sets the name + password, and the
/// KYC details (NRC / DOB / address) are completed post-login in the
/// profile wizard — which gates the loan features until 100%.
class ClientInviteScreen extends ConsumerWidget {
  const ClientInviteScreen({super.key, required this.code});

  final String code;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inviteAsync = ref.watch(inviteByCodeProvider(code));

    return Scaffold(
      body: SafeArea(
        child: inviteAsync.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(16),
            child: Column(
              children: [
                SizedBox(height: 24),
                Skeleton(width: double.infinity, height: 64, radius: 14),
                SizedBox(height: 20),
                SkeletonCard(),
                SizedBox(height: 9),
                SkeletonCard(),
                SizedBox(height: 9),
                SkeletonCard(showBadge: true),
              ],
            ),
          ),
          error: (e, _) => _ErrorView(
            message: e is InviteException
                ? e.message
                : 'This invite code is invalid or has expired. '
                    'Please ask your lender to send a new one.',
          ),
          data: (invite) => invite.completed
              ? const _AlreadyCompletedView()
              : _AccountForm(invite: invite),
        ),
      ),
    );
  }
}

// ---------- error: bad / expired / used code ----------

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: const BoxDecoration(
                color: AppColors.red50,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.link_off, size: 32, color: AppColors.red),
            ),
            const SizedBox(height: 18),
            Text('Invite not found', style: AppText.pageTitle),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppText.subText.copyWith(height: 1.5),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- already claimed ----------

class _AlreadyCompletedView extends StatelessWidget {
  const _AlreadyCompletedView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 68,
              height: 68,
              decoration: const BoxDecoration(
                color: AppColors.green50,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.task_alt,
                size: 32,
                color: AppColors.green700,
              ),
            ),
            const SizedBox(height: 18),
            Text('Code already used', style: AppText.pageTitle),
            const SizedBox(height: 8),
            Text(
              'This invite code has already been claimed. '
              'If it was you, just log in with your phone number.',
              textAlign: TextAlign.center,
              style: AppText.subText.copyWith(height: 1.5),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => context.go('/login'),
              child: const Text('Go to Login'),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- account creation (name + password + consent) ----------
// KYC (NRC / DOB / address) is intentionally NOT collected here — it is
// completed post-login in the profile wizard, which gates loan features
// until the profile reaches 100%.
class _AccountForm extends ConsumerStatefulWidget {
  const _AccountForm({required this.invite});

  final ClientInvite invite;

  @override
  ConsumerState<_AccountForm> createState() => _AccountFormState();
}

class _AccountFormState extends ConsumerState<_AccountForm> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameCtrl;
  final _passwordCtrl = TextEditingController();
  var _obscure = true;
  var _consent = false;
  var _agreeError = false;
  var _submitting = false;
  var _done = false;
  String? _error;

  ClientInvite get invite => widget.invite;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: invite.clientName);
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _passwordCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _agreeError = !_consent;
      _error = null;
    });
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (!_consent) return;

    setState(() => _submitting = true);
    try {
      await ref.read(inviteRepositoryProvider).submitAccount(
            code: invite.code,
            fullName: _nameCtrl.text,
            password: _passwordCtrl.text,
            consent: _consent,
          );
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e is InviteException
              ? e.message
              : 'Could not create your account. Check your connection.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_done) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 68,
                height: 68,
                decoration: const BoxDecoration(
                  color: AppColors.green50,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_outline,
                  size: 32,
                  color: AppColors.green700,
                ),
              ),
              const SizedBox(height: 18),
              Text('Account created', style: AppText.pageTitle),
              const SizedBox(height: 8),
              Text(
                'Your account is ready. Log in with your phone number to '
                'complete your profile and request your first loan.',
                textAlign: TextAlign.center,
                style: AppText.subText.copyWith(height: 1.5),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () => context.go('/login'),
                child: const Text('Go to Login'),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Create your account',
                  style: GoogleFonts.poppins(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Welcome, ${invite.clientName}. ${invite.businessName} '
                  'invited you to Kumvwa Finance.',
                  style: AppText.subText.copyWith(height: 1.55),
                ),
                const SizedBox(height: 24),
                AppTextField(
                  label: 'Full name',
                  controller: _nameCtrl,
                  textInputAction: TextInputAction.next,
                  enabled: !_submitting,
                  validator: (v) => Validators.required(v, field: 'Full name'),
                ),
                const SizedBox(height: 11),
                AppTextField(
                  label: 'Password',
                  controller: _passwordCtrl,
                  obscureText: _obscure,
                  textInputAction: TextInputAction.done,
                  enabled: !_submitting,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscure ? Icons.visibility_off : Icons.visibility,
                      size: 20,
                    ),
                    onPressed: () => setState(() => _obscure = !_obscure),
                  ),
                  validator: Validators.password,
                ),
                const SizedBox(height: 6),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: AppCheckbox(
                        checked: _consent,
                        onChanged: (v) => setState(() {
                          _consent = v;
                          _agreeError = false;
                        }),
                        activeColor: AppColors.green700,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => setState(() {
                          _consent = !_consent;
                          _agreeError = false;
                        }),
                        child: Text(
                          'I agree that Kumvwa Finance may keep my KYC '
                          'details for lending decisions.',
                          style: AppText.subText.copyWith(fontSize: 12.5),
                        ),
                      ),
                    ),
                  ],
                ),
                if (_agreeError) ...[
                  const SizedBox(height: 4),
                  Text(
                    'Please accept to continue.',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 12.5,
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ],
                const SizedBox(height: 22),
                ElevatedButton(
                  onPressed: _submitting ? null : _submit,
                  child: _submitting
                      ? const ButtonSpinner()
                      : const Text('Create Account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}