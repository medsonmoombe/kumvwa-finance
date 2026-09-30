import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/nrc_input_formatter.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_field.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/icon_tile.dart';

class LenderRegisterScreen extends ConsumerStatefulWidget {
  const LenderRegisterScreen({super.key});

  @override
  ConsumerState<LenderRegisterScreen> createState() =>
      _LenderRegisterScreenState();
}

class _LenderRegisterScreenState extends ConsumerState<LenderRegisterScreen> {
  int _step = 1; // 1, 2, or 3

  // Step 1 — business
  final _nameCtrl = TextEditingController();
  String _bizType = 'sacco';
  final _contactCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _tpinCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();

  // Step 2 — credentials
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  // Step 3 — BOZ cert + NRC + terms
  final _nrcCtrl = TextEditingController();
  bool _agreed = false;
  PlatformFile? _pickedFile;
  int? _termsVersion;

  bool _busy = false;
  String? _error;

  final _form1 = GlobalKey<FormState>();
  final _form2 = GlobalKey<FormState>();
  final _form3 = GlobalKey<FormState>();

  @override
  void dispose() {
    _nameCtrl.dispose();
    _contactCtrl.dispose();
    _descriptionCtrl.dispose();
    _phoneCtrl.dispose();
    _tpinCtrl.dispose();
    _addressCtrl.dispose();
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _confirmCtrl.dispose();
    _nrcCtrl.dispose();
    super.dispose();
  }

void _back() {
    if (_step == 1) {
      context.go('/register/client');
    } else {
      setState(() {
        _step--;
        _error = null;
      });
    }
  }

  void _next() {
    final key = _step == 1 ? _form1 : _form2;
    if (!(key.currentState?.validate() ?? false)) return;
    setState(() {
      _step++;
      _error = null;
    });
    // Fetch terms version when entering step 3
    if (_step == 3) _fetchTermsVersion();
  }

  Future<void> _fetchTermsVersion() async {
    try {
      final client = ref.read(apiClientProvider);
      final res = await client.getPublic('/terms/platform');
      final data = res.data as Map<String, dynamic>;
      setState(() => _termsVersion = data['version'] as int?);
    } catch (_) {
      // Non-fatal — will show error on submit if still null
    }
  }

  Future<void> _submit() async {
    if (!(_form3.currentState?.validate() ?? false)) return;
    if (_termsVersion == null) {
      setState(() => _error = 'Platform terms still loading. Please wait and try again.');
      return;
    }

    if (!_agreed) {
      setState(() => _error = 'Accept the Platform Terms to continue.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      final res = await client.postPublic(
        '/auth/register/tenant',
        data: {
          'phone': _phoneCtrl.text.trim(),
          'password': _passwordCtrl.text,
          'email': _emailCtrl.text.trim(),
          'businessName': _nameCtrl.text.trim(),
          'businessType': _bizType,
          'contactPerson': _contactCtrl.text.trim(),
          'businessDescription': _descriptionCtrl.text.trim(),
          if (_addressCtrl.text.trim().isNotEmpty)
            'address': _addressCtrl.text.trim(),
          'tpin': _tpinCtrl.text.trim(),
          'ownerNrc': _nrcCtrl.text.trim(),
          'acceptedTermsVersion': _termsVersion,
        },
      );
      final data = res.data as Map<String, dynamic>;
      client.setTokens(
        data['accessToken'] as String?,
        data['refreshToken'] as String?,
      );

      // BOZ is optional, but selected files always use the full presign ->
      // upload -> confirm flow before they are linked to the business.
      if (_pickedFile != null) {
        try {
          await _uploadOptionalBoz(client, _pickedFile!);
        } catch (_) {
          // Registration must not become unrecoverable because optional
          // supporting evidence could not be uploaded on this network.
        }
      }

      if (mounted) {
        context.go(
          '/register/lender/success',
          extra: _nameCtrl.text.trim(),
        );
      }
    } on DioException catch (e) {
      setState(() {
        _busy = false;
        _error = ApiException.fromDio(e).message;
      });
    } catch (e) {
      setState(() {
        _busy = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _uploadOptionalBoz(ApiClient client, PlatformFile file) async {
    final bytes = await file.readAsBytes();
    final extension = file.extension?.toLowerCase();
    final mime = extension == 'pdf'
        ? 'application/pdf'
        : extension == 'png'
        ? 'image/png'
        : 'image/jpeg';
    final upload = await client.postA(
      '/files/upload-url',
      data: {'kind': 'boz_certificate', 'mime': mime, 'size': bytes.length},
    );
    final data = upload.data as Map<String, dynamic>;
    final fileId = data['fileId'] as String;
    await Dio().put<void>(
      data['uploadUrl'] as String,
      data: bytes,
      options: Options(
        headers: {'Content-Type': mime, 'Content-Length': bytes.length},
      ),
    );
    await client.postA('/files/$fileId/confirm');
    await client.postA(
      '/tenants/me/verification',
      data: {'fileId': fileId, 'ownerNrc': _nrcCtrl.text.trim()},
    );
  }

  @override
  Widget build(BuildContext context) {
    final titles = ['Business details', 'Your account', 'Contact identity'];
    final subs = [
      'Tell us who is lending',
      'How you sign in to the console',
      'Identity details for platform review',
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              width: double.infinity,
              child: DomeHeader(
                small: true,
                padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
                child: DomeTitle(
                  title: titles[_step - 1],
                  subtitle: subs[_step - 1],
                  onBack: _back,
                  trailing: _StepBadge(step: _step),
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppInsets.form,
                  20,
                  AppInsets.form,
                  28,
                ),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  child: KeyedSubtree(
                    key: ValueKey(_step),
                    child: _step == 1
                        ? _Step1(
                            formKey: _form1,
                            nameCtrl: _nameCtrl,
                            bizType: _bizType,
                            onBizType: (v) => setState(() => _bizType = v),
                            contactCtrl: _contactCtrl,
                            descriptionCtrl: _descriptionCtrl,
                            phoneCtrl: _phoneCtrl,
                            tpinCtrl: _tpinCtrl,
                            addressCtrl: _addressCtrl,
                            onNext: _next,
                          )
                        : _step == 2
                        ? _Step2(
                            formKey: _form2,
                            emailCtrl: _emailCtrl,
                            passwordCtrl: _passwordCtrl,
                            confirmCtrl: _confirmCtrl,
                            onNext: _next,
                          )
                        : _Step3(
                            formKey: _form3,
                            nrcCtrl: _nrcCtrl,
                            pickedFile: _pickedFile,
                            agreed: _agreed,
                            error: _error,
                            busy: _busy,
                            onPickFile: () async {
                              final file = await FilePicker.pickFile(
                                type: FileType.custom,
                                allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
                              );
                              if (file != null) {
                                setState(() => _pickedFile = file);
                              }
                            },
                            onAgreed: (v) => setState(() => _agreed = v),
                            onSubmit: _submit,
                          ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Step 1: Business ─────────────────────────────────────────────────────────

class _Step1 extends StatelessWidget {
  const _Step1({
    required this.formKey,
    required this.nameCtrl,
    required this.bizType,
    required this.onBizType,
    required this.contactCtrl,
    required this.descriptionCtrl,
    required this.phoneCtrl,
    required this.tpinCtrl,
    required this.addressCtrl,
    required this.onNext,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl;
  final String bizType;
  final ValueChanged<String> onBizType;
  final TextEditingController contactCtrl;
  final TextEditingController descriptionCtrl;
  final TextEditingController phoneCtrl;
  final TextEditingController tpinCtrl;
  final TextEditingController addressCtrl;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppField(
            label: 'Business name *',
            controller: nameCtrl,
            hint: 'e.g. Chilenje Community SACCO',
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            formFieldKey: const ValueKey('l-name'),
            validator: (v) => (v == null || v.trim().length < 3)
                ? 'Enter the registered business name.'
                : null,
          ),
          const SizedBox(height: 12),
          _DropdownField(
            label: 'Business type *',
            value: bizType,
            items: const {
              'sacco': 'SACCO / Cooperative',
              'mfi': 'Microfinance Institution',
              'individual_lender': 'Individual Lender',
              'other': 'Other',
            },
            onChanged: onBizType,
          ),
          const SizedBox(height: 12),
          AppField(
            label: 'Contact person *',
            controller: contactCtrl,
            hint: 'Full name',
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.next,
            formFieldKey: const ValueKey('l-contact'),
            validator: (v) => (v == null || v.trim().length < 3)
                ? 'Enter a contact person.'
                : null,
          ),
          const SizedBox(height: 12),
          AppField(
            label: 'Business description *',
            controller: descriptionCtrl,
            hint: 'Describe your lending business and who you serve',
            textCapitalization: TextCapitalization.sentences,
            maxLines: 3,
            textInputAction: TextInputAction.next,
            validator: (v) => (v == null || v.trim().length < 20)
                ? 'Enter at least 20 characters about the business.'
                : null,
          ),
          const SizedBox(height: 12),
          _PhoneRow(controller: phoneCtrl),
          const SizedBox(height: 12),
          AppField(
            label: 'TPIN *',
            controller: tpinCtrl,
            hint: '1000123456',
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.next,
            inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9A-Za-z]'))],
            validator: (v) => (v == null || v.trim().isEmpty)
                ? 'TPIN is required.'
                : null,
          ),
          const SizedBox(height: 12),
          AppField(
            label: 'Physical address (optional)',
            controller: addressCtrl,
            hint: 'Plot 7, Lusaka',
            textCapitalization: TextCapitalization.sentences,
            textInputAction: TextInputAction.done,
          ),
          const SizedBox(height: 24),
          AppButton(label: 'Continue', onPressed: onNext),
        ],
      ),
    );
  }
}

// ── Step 2: Account ───────────────────────────────────────────────────────────

class _Step2 extends StatelessWidget {
  const _Step2({
    required this.formKey,
    required this.emailCtrl,
    required this.passwordCtrl,
    required this.confirmCtrl,
    required this.onNext,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController emailCtrl;
  final TextEditingController passwordCtrl;
  final TextEditingController confirmCtrl;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppField(
            label: 'Work email *',
            controller: emailCtrl,
            hint: 'info@yourbusiness.zm',
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            formFieldKey: const ValueKey('l-email'),
            validator: Validators.email,
          ),
          const SizedBox(height: 12),
          AppField(
            label: 'Password *',
            controller: passwordCtrl,
            hint: 'Min 8 characters',
            obscure: true,
            textInputAction: TextInputAction.next,
            formFieldKey: const ValueKey('l-password'),
            validator: Validators.password,
          ),
          const SizedBox(height: 12),
          AppField(
            label: 'Confirm password *',
            controller: confirmCtrl,
            hint: 'Repeat password',
            obscure: true,
            textInputAction: TextInputAction.done,
            formFieldKey: const ValueKey('l-confirm'),
            validator: (v) => v != passwordCtrl.text
                ? 'Passwords do not match.'
                : null,
          ),
          const SizedBox(height: 24),
          AppButton(label: 'Continue', onPressed: onNext),
        ],
      ),
    );
  }
}

// ── Step 3: BOZ cert + NRC + terms ───────────────────────────────────────────

class _Step3 extends StatelessWidget {
  const _Step3({
    required this.formKey,
    required this.nrcCtrl,
    required this.pickedFile,
    required this.agreed,
    required this.error,
    required this.busy,
    required this.onPickFile,
    required this.onAgreed,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nrcCtrl;
  final PlatformFile? pickedFile;
  final bool agreed;
  final String? error;
  final bool busy;
  final VoidCallback onPickFile;
  final ValueChanged<bool> onAgreed;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppUploadRow(
            title: 'BOZ registration certificate (optional)',
            subtitle: pickedFile != null
                ? pickedFile!.name
                : 'Tap to attach · PDF, JPG or PNG',
            onTap: onPickFile,
            tone: pickedFile != null ? TileTone.green : TileTone.blue,
            status: pickedFile != null ? UploadStatus.done : UploadStatus.idle,
          ),
          const SizedBox(height: 12),
          AppField(
            label: 'Contact person NRC *',
            controller: nrcCtrl,
            hint: '245711/63/1',
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            inputFormatters: [NrcInputFormatter()],
            formFieldKey: const ValueKey('l-nrc'),
            validator: Validators.nrc,
            helper: 'Used to verify the person responsible for this business.',
          ),
          const SizedBox(height: 16),
          // Terms box
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.neutral,
              borderRadius: BorderRadius.circular(AppRadii.card),
              border: Border.all(color: AppColors.line2),
            ),
            child: Text(
              'By submitting, you agree to Kumvwa\'s Platform Terms. '
              'Kumvwa provides software only and is not liable for lending '
              'decisions or client repayment. Verification takes 1–2 business days.',
              style: AppText.fine.copyWith(color: AppColors.ink2),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: () => onAgreed(!agreed),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: Checkbox(
                    value: agreed,
                    onChanged: (v) => onAgreed(v ?? false),
                    activeColor: AppColors.blue500,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(4),
                    ),
                    side: const BorderSide(color: AppColors.line, width: 1.5),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'I have read and accept the Platform Terms.',
                    style: AppText.paragraph.copyWith(color: AppColors.ink2),
                  ),
                ),
              ],
            ),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: AppColors.red50,
                borderRadius: BorderRadius.circular(AppRadii.card),
                border: Border.all(color: AppColors.redLine),
              ),
              child: Text(
                error!,
                style: AppText.paragraph.copyWith(color: AppColors.redInk),
              ),
            ),
          ],
          const SizedBox(height: 20),
          AppButton(
            label: 'Submit for verification',
            tone: AppButtonTone.green,
            onPressed: onSubmit,
            busy: busy,
          ),
          const SizedBox(height: 12),
          Text(
            "Verification takes 1–2 business days. We'll notify you the moment your institution is approved.",
            textAlign: TextAlign.center,
            style: AppText.fine,
          ),
        ],
      ),
    );
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

class _StepBadge extends StatelessWidget {
  const _StepBadge({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        '$step / 3',
        style: AppText.eyebrow.copyWith(letterSpacing: 1.2),
      ),
    );
  }
}

class _DropdownField extends StatelessWidget {
  const _DropdownField({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> items;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: AppText.fieldLabel),
        const SizedBox(height: 6),
        Container(
          height: AppSizes.field,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadii.input),
            border: Border.all(color: AppColors.line2, width: 1.5),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              icon: const Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 18,
                color: AppColors.muted,
              ),
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppColors.ink,
              ),
              onChanged: (v) { if (v != null) onChanged(v); },
              items: items.entries
                  .map(
                    (e) => DropdownMenuItem(
                      value: e.key,
                      child: Text(e.value),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ],
    );
  }
}

/// Locked +260 phone prefix row for the lender registration form.
class _PhoneRow extends StatefulWidget {
  const _PhoneRow({required this.controller});
  final TextEditingController controller;

  @override
  State<_PhoneRow> createState() => _PhoneRowState();
}

class _PhoneRowState extends State<_PhoneRow> {
  final _focus = FocusNode();
  String? _error;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() { if (mounted) setState(() {}); });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FormField<String>(
      key: const ValueKey('l-phone'),
      validator: (_) {
        final err = Validators.zmPhone(widget.controller.text);
        setState(() => _error = err);
        return err;
      },
      builder: (state) {
        final err = _error ?? (state.hasError ? state.errorText : null);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Phone number *', style: AppText.fieldLabel),
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
                    decoration: BoxDecoration(
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
                        decoration: InputDecoration(
                          isDense: true,
                          filled: true,
                          fillColor: Colors.white,
                          border: InputBorder.none,
                          enabledBorder: InputBorder.none,
                          focusedBorder: InputBorder.none,
                          errorBorder: InputBorder.none,
                          disabledBorder: InputBorder.none,
                          hintText: '97 000 0000',
                          hintStyle: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w400,
                            color: AppColors.muted,
                          ),
                          contentPadding: EdgeInsets.zero,
                        ),
                      ),
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
