import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/nrc_input_formatter.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_badge.dart';
import 'package:kumvwa_finance/core/widgets/app_note.dart';
import 'package:kumvwa_finance/core/widgets/app_phone_field.dart';
import 'package:kumvwa_finance/core/widgets/app_stepper.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/features/auth/domain/business_registration_state.dart';
import 'package:kumvwa_finance/features/auth/domain/business_type.dart';
import 'package:kumvwa_finance/features/auth/presentation/business_registration_controller.dart';

class BusinessRegistrationScreen extends ConsumerStatefulWidget {
  const BusinessRegistrationScreen({super.key});

  @override
  ConsumerState<BusinessRegistrationScreen> createState() =>
      _BusinessRegistrationScreenState();
}

class _BusinessRegistrationScreenState
    extends ConsumerState<BusinessRegistrationScreen> {
  final _businessNameCtrl = TextEditingController();
  final _nrcCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  BusinessType _selectedType = BusinessType.sacco;

  final _formKeys = List.generate(4, (_) => GlobalKey<FormState>());

  @override
  void dispose() {
    _businessNameCtrl.dispose();
    _nrcCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  bool _advance() {
    final step = ref.read(businessRegistrationControllerProvider).step;

    // Steps with forms validate first
    if (step == RegistrationStep.businessInfo) {
      if (!(_formKeys[0].currentState?.validate() ?? false)) return false;
      ref
          .read(businessRegistrationControllerProvider.notifier)
          .setBusinessInfo(_businessNameCtrl.text, _selectedType);
    } else if (step == RegistrationStep.ownerInfo) {
      if (!(_formKeys[1].currentState?.validate() ?? false)) return false;
      ref
          .read(businessRegistrationControllerProvider.notifier)
          .setOwnerInfo(_nrcCtrl.text, _phoneCtrl.text);
    } else if (step == RegistrationStep.verification) {
      if (!ref.read(businessRegistrationControllerProvider).hasCertificate) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Please attach your BOZ registration certificate'),
          ),
        );
        return false;
      }
    }
    ref.read(businessRegistrationControllerProvider.notifier).nextStep();
    return true;
  }

  void _submit() {
    // Backend integration comes later — for now "submission" is instant.
    context.go('/register/business/pending');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(businessRegistrationControllerProvider);
    final controller = ref.read(
      businessRegistrationControllerProvider.notifier,
    );
    final isLast = state.step == RegistrationStep.review;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () {
            if (state.step == RegistrationStep.businessInfo) {
              context.go('/onboarding');
            } else {
              controller.previousStep();
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Business Registration'),
            Text(
              'Step ${state.step.number} of 4 · ${state.step.title}',
              style: AppText.subText,
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: AppStepper(steps: 4, current: state.step.index),
            ),
            Expanded(
              child: IndexedStack(
                index: state.step.index,
                children: [
                  _StepBusinessInfo(
                    formKey: _formKeys[0],
                    nameCtrl: _businessNameCtrl,
                    selectedType: _selectedType,
                    onTypeChanged: (t) => setState(() => _selectedType = t),
                  ),
                  _StepOwnerInfo(
                    formKey: _formKeys[1],
                    nrcCtrl: _nrcCtrl,
                    phoneCtrl: _phoneCtrl,
                  ),
                  const _StepVerification(),
                  const _StepReview(),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
              child: ElevatedButton(
                onPressed: isLast
                    ? _submit
                    : () {
                        if (_advance()) setState(() {}); // sync dropdown state
                      },
                child: Text(isLast ? 'Submit for Verification' : 'Continue'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- Step 1: business details ----------

class _StepBusinessInfo extends StatelessWidget {
  const _StepBusinessInfo({
    required this.formKey,
    required this.nameCtrl,
    required this.selectedType,
    required this.onTypeChanged,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl;
  final BusinessType selectedType;
  final ValueChanged<BusinessType> onTypeChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              label: 'Business name',
              controller: nameCtrl,
              hint: 'e.g. Chilenje Community SACCO',
              textInputAction: TextInputAction.next,
              validator: (v) => Validators.required(v, field: 'Business name'),
            ),
            const SizedBox(height: 11),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Business type',
                  style: AppText.caption,
                ),
                const SizedBox(height: 5),
                DropdownButtonFormField<BusinessType>(
                  initialValue: selectedType,
                  items: BusinessType.values
                      .map(
                        (t) => DropdownMenuItem(
                          value: t,
                          child: Text(
                            t.label,
                            style: AppText.body,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (t) {
                    if (t != null) onTypeChanged(t);
                  },
                  decoration: const InputDecoration(),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- Step 2: owner details ----------

class _StepOwnerInfo extends StatelessWidget {
  const _StepOwnerInfo({
    required this.formKey,
    required this.nrcCtrl,
    required this.phoneCtrl,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nrcCtrl;
  final TextEditingController phoneCtrl;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AppTextField(
              label: 'Owner NRC number',
              controller: nrcCtrl,
              hint: '245711/63/1',
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.next,
              inputFormatters: [NrcInputFormatter()],
              validator: Validators.nrc,
            ),
            const SizedBox(height: 11),
            AppPhoneField(
              label: 'Phone number',
              controller: phoneCtrl,
              hint: '0971234567',
              validator: (_) => Validators.zmPhone(phoneCtrl.text),
            ),
            const SizedBox(height: 11),
            AppNote(
              child: Text(
                'Your NRC and phone number identify you across lenders. '
                'They must be unique on the Kumvwa platform.',
                style: AppText.subText.copyWith(
                  color: const Color(0xFF7A5200),
                  height: 1.55,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------- Step 3: BOZ verification ----------

class _StepVerification extends ConsumerWidget {
  const _StepVerification();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(businessRegistrationControllerProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GestureDetector(
            onTap: () => _pick(context, ref),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.blue50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFB9C6E8), width: 1.5),
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.upload_outlined,
                    size: 26,
                    color: AppColors.blue600,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Upload BOZ Registration Certificate',
                    style: AppText.body.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 3),
                  const Text('PDF or JPG · max 5MB', style: AppText.caption),
                ],
              ),
            ),
          ),
          if (state.hasCertificate) ...[
            const SizedBox(height: 11),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: AppColors.green500, width: 1.5),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check, size: 16, color: AppColors.green700),
                  const SizedBox(width: 9),
                  Expanded(
                    child: Text(
                      state.certificateName!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  const AppBadge('Attached', variant: BadgeVariant.green),
                ],
              ),
            ),
          ],
          const SizedBox(height: 11),
          AppNote(
            child: Text.rich(
              TextSpan(
                text: 'Your business must be registered with the ',
                style: AppText.subText.copyWith(
                  color: const Color(0xFF7A5200),
                  height: 1.55,
                ),
                children: [
                  const TextSpan(
                    text: 'Bank of Zambia',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const TextSpan(
                    text:
                        '. Verification usually takes 1–2 business days, and '
                        "you'll be notified once approved.",
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pick(BuildContext context, WidgetRef ref) async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
    );
    final path = file?.path;
    if (file == null || path == null) return;

    ref
        .read(businessRegistrationControllerProvider.notifier)
        .setCertificate(file.name, path);
  }
}

// ---------- Step 4: review & submit ----------

class _StepReview extends ConsumerWidget {
  const _StepReview();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(businessRegistrationControllerProvider);

    String value(String v) => v.isEmpty ? '—' : v;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(15),
            decoration: BoxDecoration(
              color: AppColors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppColors.line),
            ),
            child: Column(
              children: [
                _row('Business name', value(state.businessName)),
                _row('Business type', state.businessType?.label ?? '—'),
                _row('Owner NRC', value(state.ownerNrc)),
                _row('Phone', value(state.phone)),
                _row('BOZ certificate', state.certificateName ?? '—'),
              ],
            ),
          ),
          const SizedBox(height: 11),
          AppNote(
            child: Text(
              'Please review carefully. Your application will be locked for '
              'verification once submitted.',
              style: AppText.subText.copyWith(
                color: const Color(0xFF7A5200),
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(label, style: AppText.subText),
          ),
          Expanded(
            child: Text(
              value,
              style: AppText.body.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
