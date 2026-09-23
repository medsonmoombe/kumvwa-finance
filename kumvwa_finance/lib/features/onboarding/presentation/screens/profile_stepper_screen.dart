import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/app_stepper.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';

/// First-login profile stepper — the rich KYC profile lenders assess
/// (email, employment, income band, next of kin). Distinct from the older
/// NRC/DOB/address wizard, which handles identity documents. Submitting
/// marks `profileCompleted` server-side, which dismisses this gate.
class ProfileStepperScreen extends ConsumerStatefulWidget {
  const ProfileStepperScreen({super.key});

  @override
  ConsumerState<ProfileStepperScreen> createState() =>
      _ProfileStepperScreenState();
}

class _ProfileStepperScreenState extends ConsumerState<ProfileStepperScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _sourceCtrl = TextEditingController();
  final _kinNameCtrl = TextEditingController();
  final _kinPhoneCtrl = TextEditingController();

  String? _employment;
  String? _income;
  var _step = 0;
  var _submitting = false;
  String? _error;

  static const employments = {
    'formal_employment': 'Formal employment',
    'self_employed': 'Self-employed (business)',
    'farming': 'Farming',
    'informal': 'Informal work',
    'other': 'Other',
  };

  static const incomes = {
    'b0_1000': 'K0 – K1,000',
    'b1001_3000': 'K1,001 – K3,000',
    'b3001_6000': 'K3,001 – K6,000',
    'b6000_plus': 'K6,000+',
  };

  @override
  void dispose() {
    _emailCtrl.dispose();
    _sourceCtrl.dispose();
    _kinNameCtrl.dispose();
    _kinPhoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(apiClientProvider).putA('/clients/me/profile', data: {
        'email': _emailCtrl.text.trim(),
        if (_employment != null) 'employmentStatus': _employment,
        if (_income != null) 'incomeBand': _income,
        if (_sourceCtrl.text.trim().isNotEmpty)
          'incomeSource': _sourceCtrl.text.trim(),
        if (_kinNameCtrl.text.trim().isNotEmpty)
          'kinName': _kinNameCtrl.text.trim(),
        if (_kinPhoneCtrl.text.trim().isNotEmpty)
          'kinPhone': _kinPhoneCtrl.text.trim(),
      });
      // Re-run the gate: profileCompleted flips true and the home shows.
      ref.invalidate(clientGateProvider);
    } on ApiException catch (e) {
      if (mounted) setState(() { _submitting = false; _error = e.message; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = 'Could not save — check your connection and try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Complete your profile'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
            children: [
              AppStepper(steps: 2, current: _step),
              const SizedBox(height: 16),
              if (_step == 0) ...[
                const Text(
                  'We need a few details for your lender to assess your '
                  'applications. You only do this once.',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: AppColors.muted,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 18),
                AppTextField(
                  label: 'Email address',
                  controller: _emailCtrl,
                  hint: 'you@example.com',
                  keyboardType: TextInputType.emailAddress,
                  enabled: !_submitting,
                  validator: (v) {
                    final email = v?.trim() ?? '';
                    if (email.isEmpty) return 'Email is required';
                    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
                      return 'Enter a valid email';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 11),
                const Text(
                  'Employment status',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: employments.entries
                      .map(
                        (e) => _chip(
                          e.value,
                          _employment == e.key,
                          () => setState(() => _employment = e.key),
                        ),
                      )
                      .toList(),
                ),
                const SizedBox(height: 11),
                const Text(
                  'Monthly income',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: incomes.entries
                      .map(
                        (e) => _chip(
                          e.value,
                          _income == e.key,
                          () => setState(() => _income = e.key),
                        ),
                      )
                      .toList(),
                ),
              ] else ...[
                AppTextField(
                  label: 'Source of income',
                  controller: _sourceCtrl,
                  hint: 'e.g. Market stall at Soweto',
                  enabled: !_submitting,
                ),
                const SizedBox(height: 11),
                AppTextField(
                  label: 'Next of kin — name',
                  controller: _kinNameCtrl,
                  hint: 'Full name',
                  textInputAction: TextInputAction.next,
                  enabled: !_submitting,
                ),
                const SizedBox(height: 11),
                AppTextField(
                  label: 'Next of kin — phone',
                  controller: _kinPhoneCtrl,
                  hint: 'e.g. 0965550001',
                  keyboardType: TextInputType.phone,
                  enabled: !_submitting,
                ),
                const SizedBox(height: 14),
                const Text(
                  'Your next of kin may be contacted if we cannot reach you '
                  'about your loan.',
                  style: TextStyle(
                    fontSize: 11.5,
                    color: AppColors.muted,
                    height: 1.5,
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.red,
                    height: 1.4,
                  ),
                ),
              ],
              const SizedBox(height: 22),
              ElevatedButton(
                onPressed: _submitting
                    ? null
                    : () {
                        if (_step == 0) {
                          if (_formKey.currentState?.validate() ?? false) {
                            setState(() => _step = 1);
                          }
                        } else {
                          _submit();
                        }
                      },
                child: _submitting && _step == 1
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      )
                    : Text(_step == 0 ? 'Continue' : 'Submit Profile'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, bool on, VoidCallback onTap) {
    return GestureDetector(
      onTap: _submitting ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 9),
        decoration: BoxDecoration(
          color: on ? AppColors.blue600 : Colors.white,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: on ? AppColors.blue600 : AppColors.line),
        ),
        child: Text(
          label,
          style: GoogleFonts.poppins(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: on ? Colors.white : AppColors.ink2,
          ),
        ),
      ),
    );
  }
}
