import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/nrc_input_formatter.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_checkbox.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/app_stepper.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

/// Borrower-facing self-service profile, opened from an invite link.
class ClientInviteScreen extends ConsumerWidget {
  const ClientInviteScreen({super.key, required this.token});

  final String token;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inviteAsync = ref.watch(inviteByTokenProvider(token));

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
                : 'This invite link is invalid or has expired. '
                      'Please ask your lender to send a new one.',
          ),
          data: (invite) => invite.completed
              ? const _AlreadyCompletedView()
              : _InviteForm(invite: invite),
        ),
      ),
    );
  }
}

// ---------- error: bad / expired token ----------

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

// ---------- already completed ----------

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
            Text('Profile already completed', style: AppText.pageTitle),
            const SizedBox(height: 8),
            Text(
              'Your lender already has your details. '
              'You can log in once client accounts are live.',
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

// ---------- the 2-step form ----------

class _InviteForm extends ConsumerStatefulWidget {
  const _InviteForm({required this.invite});

  final ClientInvite invite;

  @override
  ConsumerState<_InviteForm> createState() => _InviteFormState();
}

class _InviteFormState extends ConsumerState<_InviteForm> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _nrcCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  DateTime? _dob;
  var _step = 0;
  var _consent = false;
  var _submitting = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl.text = widget.invite.clientName; // prefilled from the invite
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _nrcCtrl.dispose();
    _dobCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(1998),
      firstDate: DateTime(1930),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _dob = picked;
        _dobCtrl.text = DateFormat('dd MMM yyyy').format(picked);
      });
    }
  }

  Future<void> _submit() async {
    if (!_consent) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please provide consent to continue')),
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref
          .read(inviteRepositoryProvider)
          .submitProfile(
            token: widget.invite.token,
            nrc: _nrcCtrl.text.trim(),
            dateOfBirth: _dob!,
            address: _addressCtrl.text.trim(),
          );
      if (mounted) setState(() => _step = 2); // success view
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_step == 2) return const _SubmittedView();

    return Column(
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
            child: _step == 0 ? _details() : _review(),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
          child: _bottomButton(),
        ),
      ],
    );
  }

  // ---------- step 1: details ----------

  Widget _details() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _InviteBanner(invite: widget.invite),
          const SizedBox(height: 16),
          const AppStepper(steps: 2, current: 0),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Full name',
            controller: _nameCtrl,
            textInputAction: TextInputAction.next,
            validator: (v) => Validators.required(v, field: 'Full name'),
          ),
          const SizedBox(height: 11),
          AppTextField(
            label: 'NRC number',
            controller: _nrcCtrl,
            hint: '245711/63/1',
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            inputFormatters: [NrcInputFormatter()],
            validator: Validators.nrc,
          ),
          const SizedBox(height: 11),
          AppTextField(
            label: 'Date of birth',
            controller: _dobCtrl,
            hint: 'Tap to select',
            readOnly: true,
            suffixIcon: const Icon(
              Icons.calendar_today_outlined,
              size: 18,
              color: AppColors.muted,
            ),
            onTap: _pickDob,
            validator: (_) => Validators.adultDob(_dob),
          ),
          const SizedBox(height: 11),
          AppTextField(
            label: 'Home address',
            controller: _addressCtrl,
            hint: 'Plot no., street, town',
            maxLines: 2,
            textInputAction: TextInputAction.done,
            validator: (v) => Validators.required(v, field: 'Home address'),
          ),
        ],
      ),
    );
  }

  // ---------- step 2: review + consent ----------

  Widget _review() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _InviteBanner(invite: widget.invite),
        const SizedBox(height: 16),
        const AppStepper(steps: 2, current: 1),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(15),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.line),
          ),
          child: Column(
            children: [
              _row('Full name', _nameCtrl.text),
              _row('NRC', _nrcCtrl.text),
              _row('Date of birth', _dobCtrl.text),
              _row('Phone', widget.invite.phone),
              _row('Address', _addressCtrl.text),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(13),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.line),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppCheckbox(
                checked: _consent,
                onChanged: (v) => setState(() => _consent = v),
                activeColor: AppColors.green500,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'I consent to my NRC being used for a credit reference '
                  'check with TransUnion / Experian Zambia.',
                  style: AppText.subText.copyWith(
                    color: AppColors.ink2,
                    height: 1.55,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _bottomButton() {
    if (_step == 0) {
      return ElevatedButton(
        onPressed: () {
          if (_formKey.currentState?.validate() ?? false) {
            setState(() => _step = 1);
          }
        },
        child: const Text('Continue'),
      );
    }
    return Row(
      children: [
        OutlinedButton(
          onPressed: _submitting ? null : () => setState(() => _step = 0),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.ink2,
            side: const BorderSide(color: AppColors.line),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(13),
            ),
            fixedSize: const Size(90, 52),
            padding: EdgeInsets.zero,
          ),
          child: const Icon(Icons.arrow_back_ios_new, size: 17),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: ElevatedButton(
            onPressed: _submitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.green500,
            ),
            child: _submitting
                ? const ButtonSpinner()
                : const Text('Submit Profile'),
          ),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: AppText.subText),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '—' : value,
              style: AppText.body.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------- shared pieces ----------

class _InviteBanner extends StatelessWidget {
  const _InviteBanner({required this.invite});

  final ClientInvite invite;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.green50,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFBFE9D2)),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.mark_email_unread_outlined,
            size: 20,
            color: AppColors.green700,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              '${invite.businessName} has invited you to complete your '
              'borrower profile.',
              style: AppText.subText.copyWith(
                color: const Color(0xFF155C39),
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubmittedView extends StatelessWidget {
  const _SubmittedView();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
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
              'Profile submitted',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(
              'Your lender can now see your profile and may offer you a loan. '
              'Keep an eye on your phone for updates.',
              textAlign: TextAlign.center,
              style: AppText.body.copyWith(
                color: AppColors.ink2,
                height: 1.55,
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/login'),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }
}
