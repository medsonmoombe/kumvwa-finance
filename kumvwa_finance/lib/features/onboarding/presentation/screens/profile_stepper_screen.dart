import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/app_stepper.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';
import 'package:kumvwa_finance/features/clients/data/clients_repository.dart';

class ProfileStepperScreen extends ConsumerStatefulWidget {
  const ProfileStepperScreen({super.key});

  @override
  ConsumerState<ProfileStepperScreen> createState() =>
      _ProfileStepperScreenState();
}

class _ProfileStepperScreenState extends ConsumerState<ProfileStepperScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _otherEmploymentCtrl = TextEditingController();
  final _kinNameCtrl = TextEditingController();
  final _kinPhoneCtrl = TextEditingController();
  final _kin2NameCtrl = TextEditingController();
  final _kin2PhoneCtrl = TextEditingController();

  String? _employment;
  String? _sector;
  String? _education;
  String? _income;
  String? _nrcPhotoFileId;
  String? _nrcPhotoName;
  String? _nrcBackFileId;
  String? _nrcBackName;
  bool _uploadingNrc = false;
  var _step = 0; // 0=employment+education, 1=nrc photos, 2=kin
  var _submitting = false;
  String? _error;
  var _seeded = false;

  static const employments = {
    'formal_employment': 'Formal employment',
    'self_employed': 'Self-employed',
    'farming': 'Farming',
    'informal': 'Informal work',
    'other': 'Other',
  };

  static const sectors = [
    'Government / Public sector',
    'Education',
    'Healthcare',
    'Finance / Banking',
    'Mining',
    'Agriculture',
    'Retail / Trade',
    'Construction',
    'Transport / Logistics',
    'NGO / Non-profit',
    'Other',
  ];

  static const educationLevels = {
    'none': 'No formal education',
    'primary': 'Primary school',
    'junior_secondary': 'Junior secondary (Grade 9)',
    'senior_secondary': 'Senior secondary (Grade 12)',
    'certificate': 'Certificate',
    'diploma': 'Diploma',
    'degree': 'University degree',
    'postgraduate': 'Postgraduate',
  };

  static const incomes = {
    'b0_1000': 'K0 – K1,000',
    'b1001_3000': 'K1,001 – K3,000',
    'b3001_6000': 'K3,001 – K6,000',
    'b6000_plus': 'K6,000 and above',
  };

  @override
  void dispose() {
    _emailCtrl.dispose();
    _otherEmploymentCtrl.dispose();
    _kinNameCtrl.dispose();
    _kinPhoneCtrl.dispose();
    _kin2NameCtrl.dispose();
    _kin2PhoneCtrl.dispose();
    super.dispose();
  }

  /// Seed all fields from existing profile on first load.
  void _seedFromProfile() {
    if (_seeded) return;
    final p = ref.read(clientMeProvider).valueOrNull;
    if (p == null) return;
    _seeded = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      setState(() {
        if (p.email != null && p.email!.isNotEmpty) {
          _emailCtrl.text = p.email!;
        }
        if (p.employmentStatus != null) _employment = p.employmentStatus;
        if (p.educationLevel != null) _education = p.educationLevel;
        if (p.incomeBand != null) _income = p.incomeBand;
        if (p.incomeSource != null) {
          if (p.employmentStatus == 'formal_employment') {
            _sector = p.incomeSource;
          } else if (p.employmentStatus == 'other') {
            _otherEmploymentCtrl.text = p.incomeSource!;
          }
        }
        if (p.kinName != null) _kinNameCtrl.text = p.kinName!;
        if (p.kinPhone != null) _kinPhoneCtrl.text = p.kinPhone!;
        if (p.kin2Name != null) _kin2NameCtrl.text = p.kin2Name!;
        if (p.kin2Phone != null) _kin2PhoneCtrl.text = p.kin2Phone!;
        // A side already on file must read as done, not as a fresh upload.
        if (p.nrcPhotoFileId != null) _nrcPhotoFileId = p.nrcPhotoFileId;
        if (p.nrcBackPhotoFileId != null) _nrcBackFileId = p.nrcBackPhotoFileId;
      });
    });
  }

  /// Picks and uploads one side of the NRC. Both sides use the API's
  /// `nrc_photo` file kind — the kind describes the document, not the face.
  Future<void> _pickAndUploadNrc({required bool isBack}) async {
    final result = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['jpg', 'jpeg', 'png'],
    );
    if (result.isEmpty) return;
    final file = result.first;

    setState(() {
      _uploadingNrc = true;
      _error = null;
    });
    try {
      final bytes = await file.readAsBytes();
      final api = ref.read(apiClientProvider);
      final mime = file.extension?.toLowerCase() == 'png'
          ? 'image/png'
          : 'image/jpeg';

      final urlRes = await api.postA(
        '/files/client/upload-url',
        data: {'kind': 'nrc_photo', 'mime': mime, 'size': bytes.length},
      );
      final urlData = urlRes.data as Map<String, dynamic>;
      final fileId = urlData['fileId'] as String;
      final uploadUrl = urlData['uploadUrl'] as String;

      await Dio().put<void>(
        uploadUrl,
        data: bytes,
        options: Options(
          headers: {'Content-Type': mime, 'Content-Length': bytes.length},
        ),
      );

      await api.postA('/files/client/$fileId/confirm');

      setState(() {
        if (isBack) {
          _nrcBackFileId = fileId;
          _nrcBackName = file.name;
        } else {
          _nrcPhotoFileId = fileId;
          _nrcPhotoName = file.name;
        }
        _uploadingNrc = false;
      });
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _uploadingNrc = false;
          final data = e.response?.data;
          String msg = 'Could not upload photo. Please try again.';
          if (data is Map) {
            final raw = data['message'];
            if (raw is List) {
              msg = raw.join('\n');
            } else if (raw != null) {
              msg = raw.toString();
            }
          }
          _error = msg;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _uploadingNrc = false;
          _error = 'Could not upload photo. Please try again.';
        });
      }
    }
  }

  /// Shows the borrower the face already on file. The presigned URL is minted
  /// on open (it lives 15 minutes), so the viewer never shows an expired image.
  void _viewNrc({required bool isBack}) {
    showDialog<void>(
      context: context,
      builder: (_) => _NrcPhotoDialog(
        title: isBack ? 'NRC back' : 'NRC front',
        side: isBack ? 'back' : 'front',
      ),
    );
  }

  Future<void> _submit() async {
    setState(() {
      _submitting = true;
      _error = null;
    });

    final email = _emailCtrl.text.trim().isNotEmpty
        ? _emailCtrl.text.trim()
        : (ref.read(clientMeProvider).valueOrNull?.email ?? '');

    if (email.isEmpty) {
      setState(() {
        _submitting = false;
        _error = 'Please enter your email address.';
      });
      return;
    }

    final String? incomeSource;
    if (_employment == 'formal_employment' && _sector != null) {
      incomeSource = _sector;
    } else if (_employment == 'other' &&
        _otherEmploymentCtrl.text.trim().isNotEmpty) {
      incomeSource = _otherEmploymentCtrl.text.trim();
    } else {
      incomeSource = null;
    }

    try {
      await ref
          .read(apiClientProvider)
          .putA(
            '/clients/me/profile',
            data: {
              'email': email,
              'employmentStatus': ?_employment,
              'educationLevel': ?_education,
              'incomeBand': ?_income,
              'incomeSource': ?incomeSource,
              if (_kinNameCtrl.text.trim().isNotEmpty)
                'kinName': _kinNameCtrl.text.trim(),
              if (_kinPhoneCtrl.text.trim().isNotEmpty)
                'kinPhone': _kinPhoneCtrl.text.trim(),
              if (_kin2NameCtrl.text.trim().isNotEmpty)
                'kin2Name': _kin2NameCtrl.text.trim(),
              if (_kin2PhoneCtrl.text.trim().isNotEmpty)
                'kin2Phone': _kin2PhoneCtrl.text.trim(),
              'nrcPhotoFileId': ?_nrcPhotoFileId,
              'nrcBackPhotoFileId': ?_nrcBackFileId,
            },
          );
      ref.invalidate(clientGateProvider);
      ref.invalidate(clientMeProvider);
    } catch (e) {
      if (!mounted) return;
      String msg = 'Could not save. Please try again.';
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map) {
          final raw = data['message'];
          if (raw is List) {
            msg = raw.join('\n');
          } else if (raw != null) {
            msg = raw.toString();
          }
        }
      }
      setState(() {
        _submitting = false;
        _error = msg;
      });
    }
  }

  static String? _validateEmail(String? v, String? onFile) {
    final email = v?.trim() ?? '';
    if (email.isEmpty) {
      return (onFile == null || onFile.isEmpty) ? 'Email is required' : null;
    }
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) {
      return 'Enter a valid email';
    }
    return null;
  }

  /// Step 0 required selections, in order. Returns the first missing field
  /// message, or null once the step is complete — a client can't advance past
  /// employment / sector / education / income until they're all filled.
  String? _missingStep0() {
    if (_employment == null) return 'Select your employment status';
    if (_employment == 'formal_employment' && _sector == null) {
      return 'Select your employment sector';
    }
    if (_education == null) return 'Select your education level';
    if (_income == null) return 'Select your income range';
    return null;
  }

  /// Step 2 required fields (next of kin) — same binding rule as step 0.
  String? _missingStep2() {
    if (_kinNameCtrl.text.trim().isEmpty) return 'Enter your next of kin name';
    if (_kinPhoneCtrl.text.trim().isEmpty) {
      return 'Enter your next of kin phone';
    }
    if (!RegExp(r'^0[5-9]\d{8}$').hasMatch(_kinPhoneCtrl.text.trim())) {
      return 'Enter a valid Zambian mobile number for your first next of kin';
    }
    if (_kin2NameCtrl.text.trim().isEmpty) {
      return 'Enter a second next of kin name';
    }
    if (!RegExp(r'^0[5-9]\d{8}$').hasMatch(_kin2PhoneCtrl.text.trim())) {
      return 'Enter a valid Zambian mobile number for your second next of kin';
    }
    if (_kinPhoneCtrl.text.trim() == _kin2PhoneCtrl.text.trim()) {
      return 'Your two next of kin must have different phone numbers';
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(clientMeProvider).valueOrNull;
    _seedFromProfile();
    final onFile = profile?.email;

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
              AppStepper(steps: 3, current: _step),
              const SizedBox(height: 16),

              // ── Step 0: employment + education + income ──
              if (_step == 0) ...[
                const Text(
                  'We need a few details for your lender to assess your applications.',
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
                  validator: (v) => _validateEmail(v, onFile),
                ),
                if (onFile != null && onFile.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  const Text(
                    'Prefilled from your lender. Change it if wrong.',
                    style: TextStyle(fontSize: 10.5, color: AppColors.muted),
                  ),
                ],
                const SizedBox(height: 18),
                _fieldLabel('Employment status'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: employments.entries
                      .map(
                        (e) => _chip(
                          e.value,
                          _employment == e.key,
                          () => setState(() {
                            _employment = e.key;
                            _sector = null;
                            _otherEmploymentCtrl.clear();
                          }),
                        ),
                      )
                      .toList(),
                ),
                if (_employment == 'formal_employment') ...[
                  const SizedBox(height: 14),
                  _fieldLabel('Employment sector'),
                  const SizedBox(height: 8),
                  _dropdown(
                    value: _sector,
                    hint: 'Select your sector',
                    items: sectors
                        .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                        .toList(),
                    onChanged: (v) => setState(() => _sector = v),
                  ),
                ],
                if (_employment == 'other') ...[
                  const SizedBox(height: 14),
                  AppTextField(
                    label: 'Describe your work',
                    controller: _otherEmploymentCtrl,
                    hint: 'e.g. Tailoring, market vending',
                    enabled: !_submitting,
                  ),
                ],
                const SizedBox(height: 18),
                _fieldLabel('Highest education level'),
                const SizedBox(height: 8),
                _dropdown(
                  value: _education,
                  hint: 'Select education level',
                  items: educationLevels.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _education = v),
                ),
                const SizedBox(height: 18),
                _fieldLabel('Monthly income'),
                const SizedBox(height: 8),
                _dropdown(
                  value: _income,
                  hint: 'Select income range',
                  items: incomes.entries
                      .map(
                        (e) => DropdownMenuItem(
                          value: e.key,
                          child: Text(e.value),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() => _income = v),
                ),
              ]
              // ── Step 1: NRC photo (both faces) ──
              else if (_step == 1) ...[
                _fieldLabel('NRC photos'),
                const SizedBox(height: 6),
                const Text(
                  'Upload clear photos of both sides of your National Registration Card. JPEG or PNG only.',
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.muted,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _NrcUploadTile(
                        asset: 'assets/images/nrc_front.svg',
                        caption: 'Front',
                        fileId: _nrcPhotoFileId,
                        fileName: _nrcPhotoName,
                        busy: _uploadingNrc,
                        onView: () => _viewNrc(isBack: false),
                        onTap: _uploadingNrc
                            ? null
                            : () => _pickAndUploadNrc(isBack: false),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _NrcUploadTile(
                        asset: 'assets/images/nrc_back.svg',
                        caption: 'Back',
                        fileId: _nrcBackFileId,
                        fileName: _nrcBackName,
                        busy: _uploadingNrc,
                        onView: () => _viewNrc(isBack: true),
                        onTap: _uploadingNrc
                            ? null
                            : () => _pickAndUploadNrc(isBack: true),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                const Text(
                  'Optional — you can skip this and add the photos later from your profile.',
                  style: TextStyle(fontSize: 11, color: AppColors.muted),
                ),
              ]
              // ── Step 2: next of kin ──
              else ...[
                _fieldLabel('Next of kin name'),
                const SizedBox(height: 8),
                AppTextField(
                  label: '',
                  controller: _kinNameCtrl,
                  hint: 'Full name',
                  textInputAction: TextInputAction.next,
                  enabled: !_submitting,
                ),
                const SizedBox(height: 14),
                _fieldLabel('Next of kin phone'),
                const SizedBox(height: 8),
                AppTextField(
                  label: '',
                  controller: _kinPhoneCtrl,
                  hint: '0965550001',
                  keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  enabled: !_submitting,
                ),
                const SizedBox(height: 20),
                _fieldLabel('Second next of kin name'),
                const SizedBox(height: 8),
                AppTextField(
                  label: '',
                  controller: _kin2NameCtrl,
                  hint: 'Full name',
                  textInputAction: TextInputAction.next,
                  enabled: !_submitting,
                ),
                const SizedBox(height: 14),
                _fieldLabel('Second next of kin phone'),
                const SizedBox(height: 8),
                AppTextField(
                  label: '',
                  controller: _kin2PhoneCtrl,
                  hint: '0975550002',
                  keyboardType: TextInputType.phone,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  enabled: !_submitting,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Provide two different Zambian mobile numbers. They may be contacted if we cannot reach you about your loan.',
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
                          final emailOk =
                              _formKey.currentState?.validate() ?? false;
                          final missing = _missingStep0();
                          if (emailOk && missing == null) {
                            setState(() {
                              _error = null;
                              _step = 1;
                            });
                          } else {
                            setState(
                              () => _error =
                                  missing ??
                                  'Please fix the highlighted fields.',
                            );
                          }
                        } else if (_step == 1) {
                          setState(() {
                            _error = null;
                            _step = 2;
                          });
                        } else {
                          final err = _missingStep2();
                          if (err == null) {
                            _submit();
                          } else {
                            setState(() => _error = err);
                          }
                        }
                      },
                child: _submitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      )
                    : Text(_step == 2 ? 'Submit Profile' : 'Continue'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(
    text,
    style: const TextStyle(
      fontSize: 13,
      fontWeight: FontWeight.w600,
      color: AppColors.ink,
    ),
  );
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

  Widget _dropdown({
    required String? value,
    required String hint,
    required List<DropdownMenuItem<String>> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value,
          hint: Text(
            hint,
            style: const TextStyle(fontSize: 13.5, color: AppColors.muted),
          ),
          isExpanded: true,
          icon: const Icon(
            Icons.keyboard_arrow_down_rounded,
            color: AppColors.muted,
          ),
          style: const TextStyle(fontSize: 13.5, color: AppColors.ink),
          items: items,
          onChanged: _submitting ? null : onChanged,
        ),
      ),
    );
  }
}

/// One side of the NRC — its own SVG glyph so the borrower can tell the front
/// of the card from the back at a glance, plus the captured/replace state.
class _NrcUploadTile extends StatelessWidget {
  const _NrcUploadTile({
    required this.asset,
    required this.caption,
    required this.fileId,
    required this.fileName,
    required this.busy,
    required this.onTap,
    required this.onView,
  });

  /// Side-specific card glyph (front shows the photo, back the stripe).
  final String asset;
  final String caption;
  final String? fileId;
  final String? fileName;
  final bool busy;
  final VoidCallback? onTap;

  /// Opens the stored photo — only rendered once a face is on file.
  final VoidCallback onView;

  @override
  Widget build(BuildContext context) {
    final done = fileId != null;

    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 10),
        decoration: BoxDecoration(
          color: done ? AppColors.green50 : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: done ? AppColors.green500 : AppColors.line,
            width: done ? 1.5 : 1,
          ),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (busy)
              const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              )
            else
              Stack(
                alignment: Alignment.bottomRight,
                children: [
                  SvgPicture.asset(
                    asset,
                    width: 46,
                    height: 46,
                    // The SVG is drawn in the app's blue; dim it slightly so a
                    // filled tile doesn't shout next to the label.
                    colorFilter: ColorFilter.mode(
                      done ? AppColors.green500 : AppColors.blue600,
                      BlendMode.srcIn,
                    ),
                  ),
                  if (done)
                    Container(
                      decoration: const BoxDecoration(
                        color: AppColors.green500,
                        shape: BoxShape.circle,
                      ),
                      padding: const EdgeInsets.all(1.5),
                      child: const Icon(
                        Icons.check_rounded,
                        size: 11,
                        color: Colors.white,
                      ),
                    ),
                ],
              ),
            const SizedBox(height: 10),
            Text(
              caption,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              done ? (fileName ?? 'Added') : 'Tap to select',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: done ? FontWeight.w600 : FontWeight.w400,
                color: done ? AppColors.green700 : AppColors.muted,
              ),
            ),
            if (done) ...[
              const SizedBox(height: 2),
              const Text(
                'Tap to replace',
                style: TextStyle(fontSize: 10, color: AppColors.muted),
              ),
              const SizedBox(height: 6),
              // Its own tap target inside the tile: the inner gesture wins, so
              // viewing never triggers a re-pick.
              GestureDetector(
                onTap: busy ? null : onView,
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  child: Text(
                    'View photo',
                    style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: AppColors.blue600,
                      decoration: TextDecoration.underline,
                      decorationColor: AppColors.blue600,
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Full-screen view of an NRC face the borrower already uploaded. The URL is
/// fetched on open — presigned links expire in 15 minutes, so caching one in
/// the stepper would show a broken image on the next visit.
class _NrcPhotoDialog extends ConsumerStatefulWidget {
  const _NrcPhotoDialog({required this.title, required this.side});

  final String title;
  final String side;

  @override
  ConsumerState<_NrcPhotoDialog> createState() => _NrcPhotoDialogState();
}

class _NrcPhotoDialogState extends ConsumerState<_NrcPhotoDialog> {
  Future<String>? _url;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    setState(() {
      _url = ref.read(clientsRepositoryProvider).nrcPhotoUrl(side: widget.side);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 14, 14),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.title,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            FutureBuilder<String>(
              future: _url,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(strokeWidth: 2.4),
                      ),
                    ),
                  );
                }

                final url = snapshot.data;
                if (snapshot.hasError || url == null || url.isEmpty) {
                  return _failure();
                }

                return ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    url,
                    height: 320,
                    fit: BoxFit.contain,
                    loadingBuilder: (context, child, progress) =>
                        progress == null
                        ? child
                        : const SizedBox(
                            height: 320,
                            child: Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                ),
                              ),
                            ),
                          ),
                    errorBuilder: (_, _, _) => _failure(),
                  ),
                );
              },
            ),
            const SizedBox(height: 8),
            const Text(
              'Only you and your lender can open this photo.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10.5, color: AppColors.muted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _failure() => Padding(
    padding: const EdgeInsets.symmetric(vertical: 28),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'Could not open the photo.',
          style: TextStyle(fontSize: 12.5, color: AppColors.muted),
        ),
        TextButton(onPressed: _load, child: const Text('Try again')),
      ],
    ),
  );
}
