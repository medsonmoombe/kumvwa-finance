import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:dio/dio.dart';

import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/nrc_input_formatter.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';
import 'package:kumvwa_finance/features/profile/domain/client_profile.dart';

/// Post-login KYC wizard. The invite only minted the account (name + phone
/// = 40%); the borrower adds NRC (+20), date of birth (+20) and address
/// (+20) here, in their own app. A progress bar shows the current %
/// complete and the loan features stay gated (via the router redirect)
/// until the profile reaches 100%.
class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() =>
      _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _nrcCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  DateTime? _dob;
  var _saving = false;
  String? _error;

  @override
  void dispose() {
    _nrcCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDob() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(now.year - 25, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked != null) setState(() => _dob = picked);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    final dobError = Validators.adultDob(_dob);
    if (dobError != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(dobError)));
      return;
    }

    setState(() => _saving = true);
    try {
      final profile = await ref.read(clientsRepositoryProvider).updateProfile(
            nrc: _nrcCtrl.text,
            dateOfBirth: _dob,
            address: _addressCtrl.text,
          );
      if (!mounted) return;

      // Reflect the new completeness in the session so the router's
      // needsProfile redirect lets the borrower into the app.
      final session = ref.read(authControllerProvider).session;
      if (session != null) {
        ref.read(authControllerProvider.notifier).applyUpdatedSession(
              session.copyWith(
                profileComplete: profile.complete,
                profilePercent: profile.profilePercent,
              ),
            );
      }

      if (profile.complete) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile complete — you can now request loans.'),
          ),
        );
        context.go('/c/home');
      } else {
        // Reflect fresh `missing`/percent so the next build stops asking for
        // whatever was just saved.
        ref.invalidate(clientMeProvider);
        if (mounted) {
          setState(() {
            _saving = false;
            _nrcCtrl.clear();
            _addressCtrl.clear();
            _dob = null;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          // Surface the server's reason (e.g. "This NRC is already in use"
          // or another phone's 409) instead of masking it with a generic
          // message. Dio fails aren't pre-wrapped, so convert them here.
          final known = switch (e) {
            final ApiException err => err.message,
            final DioException err => ApiException.fromDio(err).message,
            _ => null,
          };
          _error =
              known ?? 'Could not save — check your connection and try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final percent = session?.profilePercent ?? 0;
    final done = session?.profileComplete ?? false;
    final meAsync = ref.watch(clientMeProvider);

    return Scaffold(
      body: SafeArea(
        child: meAsync.when(
          loading: () =>
              const Center(child: AppLoader(message: 'Loading profile…')),
          error: (_, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.cloud_off_outlined,
                      size: 44, color: AppColors.muted),
                  const SizedBox(height: 14),
                  const Text('Could not load your profile'),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () => ref.invalidate(clientMeProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (profile) => _buildForm(context, profile, percent, done),
        ),
      ),
      bottomNavigationBar: done
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
                child: ElevatedButton(
                  onPressed: () => context.go('/c/home'),
                  child: const Text('Continue'),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildForm(
    BuildContext context,
    ClientProfile profile,
    int percent,
    bool done,
  ) {
    final missing = profile.missing;
    final hasNrc = profile.nrcMasked != null;
    final hasDob = profile.dateOfBirth != null;
    final hasAddress = (profile.address ?? '').trim().isNotEmpty;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: 60,
            height: 60,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: AppColors.green50,
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.badge_outlined,
                size: 28, color: AppColors.green700),
          ),
          const SizedBox(height: 18),
          Text(
            'Complete your profile',
            style: GoogleFonts.poppins(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Your account is $percent% complete. Add your identity '
            'details below to unlock loan requests.',
            style: AppText.subText.copyWith(height: 1.55),
          ),
          const SizedBox(height: 18),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: percent / 100,
              minHeight: 9,
              backgroundColor: AppColors.green50,
              color: AppColors.green700,
            ),
          ),
          const SizedBox(height: 14),
          if (missing.isNotEmpty) ...[
            Text(
              'Still needed: ${missing.join(', ')}',
              style: const TextStyle(
                fontSize: 11.5,
                fontWeight: FontWeight.w700,
                color: AppColors.blue600,
              ),
            ),
            const SizedBox(height: 14),
          ],
          _StepHeader(index: 1, label: 'NRC number', done: hasNrc),
          const SizedBox(height: 8),
          AppTextField(
            label: hasNrc ? 'NRC (verified)' : 'NRC number',
            controller: _nrcCtrl,
            hint: '245711/63/1',
            enabled: !hasNrc && !_saving,
            keyboardType: TextInputType.number,
            inputFormatters: [NrcInputFormatter()],
            validator: Validators.nrc,
          ),
          if (hasNrc) ...[
            const SizedBox(height: 4),
            const Text(
              'Stored as encrypted ciphertext.',
              style: TextStyle(fontSize: 10.5, color: AppColors.muted),
            ),
          ],
          const SizedBox(height: 16),
          _StepHeader(index: 2, label: 'Date of birth', done: hasDob),
          const SizedBox(height: 8),
          AppTextField(
            label: 'Date of birth',
            controller: TextEditingController(
              text: _dob == null
                  ? ''
                  : '${_dob!.day}/${_dob!.month}/${_dob!.year}',
            ),
            hint: 'Select date',
            readOnly: true,
            enabled: !_saving,
            onTap: _pickDob,
            suffixIcon:
                const Icon(Icons.calendar_today_outlined, size: 18),
          ),
          const SizedBox(height: 16),
          _StepHeader(index: 3, label: 'Home address', done: hasAddress),
          const SizedBox(height: 8),
          AppTextField(
            label: 'Home address',
            controller: _addressCtrl,
            hint: 'e.g. Plot 12, Chilenje, Lusaka',
            maxLines: 2,
            enabled: !_saving,
            validator: (v) => Validators.required(v, field: 'Address'),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12.5,
                color: Theme.of(context).colorScheme.error,
              ),
            ),
          ],
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const ButtonSpinner()
                : const Text('Save Profile'),
          ),
        ],
      ),
    );
  }
}

class _StepHeader extends StatelessWidget {
  const _StepHeader({
    required this.index,
    required this.label,
    required this.done,
  });

  final int index;
  final String label;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 20,
          height: 20,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: done ? AppColors.green700 : AppColors.blue50,
            shape: BoxShape.circle,
          ),
          child: done
              ? const Icon(Icons.check, size: 13, color: Colors.white)
              : Text(
                  '$index',
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: AppColors.blue600,
                  ),
                ),
        ),
        const SizedBox(width: 9),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w700,
            color: AppColors.ink,
          ),
        ),
      ],
    );
  }
}