import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
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

/// The lender's own review document. A rejected application can be returned
/// to the queue with updated contact identity and, if useful, fresh BOZ proof.
class LenderApplicationReviewScreen extends ConsumerStatefulWidget {
  const LenderApplicationReviewScreen({super.key});

  @override
  ConsumerState<LenderApplicationReviewScreen> createState() =>
      _LenderApplicationReviewScreenState();
}

class _LenderApplicationReviewScreenState
    extends ConsumerState<LenderApplicationReviewScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _tpinCtrl = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _descriptionCtrl = TextEditingController();
  final _nrcCtrl = TextEditingController();
  var _businessType = 'sacco';
  Map<String, dynamic>? _tenant;
  PlatformFile? _bozFile;
  String? _error;
  var _loading = true;
  var _submitting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _addressCtrl.dispose();
    _tpinCtrl.dispose();
    _contactCtrl.dispose();
    _descriptionCtrl.dispose();
    _nrcCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref.read(apiClientProvider).getA('/tenants/me');
      if (!mounted) return;
      setState(() {
        _tenant = Map<String, dynamic>.from(result.data as Map);
        _nameCtrl.text = _tenant!['name'] as String? ?? '';
        _businessType = _tenant!['type'] as String? ?? 'sacco';
        _emailCtrl.text = _tenant!['email'] as String? ?? '';
        _addressCtrl.text = _tenant!['address'] as String? ?? '';
        _tpinCtrl.text = _tenant!['tpin'] as String? ?? '';
        _contactCtrl.text = _tenant!['contactPerson'] as String? ?? '';
        _descriptionCtrl.text =
            _tenant!['businessDescription'] as String? ?? '';
        _loading = false;
      });
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _error = ApiException.fromDio(e).message;
          _loading = false;
        });
      }
    }
  }

  Future<String> _uploadBoz(ApiClient client, PlatformFile file) async {
    final bytes = await file.readAsBytes();
    final ext = file.extension?.toLowerCase();
    final mime = ext == 'pdf'
        ? 'application/pdf'
        : ext == 'png'
        ? 'image/png'
        : 'image/jpeg';
    final start = await client.postA(
      '/files/upload-url',
      data: {'kind': 'boz_certificate', 'mime': mime, 'size': bytes.length},
    );
    final data = start.data as Map<String, dynamic>;
    final fileId = data['fileId'] as String;
    await Dio().put<void>(
      data['uploadUrl'] as String,
      data: bytes,
      options: Options(
        headers: {'Content-Type': mime, 'Content-Length': bytes.length},
      ),
    );
    await client.postA('/files/$fileId/confirm');
    return fileId;
  }

  Future<void> _resubmit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      await api.patchA(
        '/tenants/me/application',
        data: {
          'businessName': _nameCtrl.text.trim(),
          'businessType': _businessType,
          'email': _emailCtrl.text.trim(),
          'address': _addressCtrl.text.trim(),
          'tpin': _tpinCtrl.text.trim(),
          'contactPerson': _contactCtrl.text.trim(),
          'businessDescription': _descriptionCtrl.text.trim(),
        },
      );
      if (_bozFile == null) {
        await api.postA(
          '/tenants/me/resubmit',
          data: {'ownerNrc': _nrcCtrl.text.trim()},
        );
      } else {
        final fileId = await _uploadBoz(api, _bozFile!);
        await api.postA(
          '/tenants/me/verification',
          data: {'fileId': fileId, 'ownerNrc': _nrcCtrl.text.trim()},
        );
      }
      if (mounted) context.go('/lender/home');
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _error = ApiException.fromDio(e).message;
          _submitting = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Could not resubmit your application. Please try again.';
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(child: CircularProgressIndicator(color: AppColors.blue600)),
      );
    }
    final tenant = _tenant;
    if (tenant == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Center(
          child: AppButton(label: 'Try again', onPressed: _load),
        ),
      );
    }
    final rejected = tenant['status'] == 'rejected';
    final note = tenant['verificationNote'] as String?;
    final history = (tenant['reviewHistory'] as List? ?? const <dynamic>[])
        .whereType<Map>()
        .map((event) => Map<String, dynamic>.from(event))
        .toList();
    final rejectionCount = (tenant['rejectionCount'] as num?)?.toInt() ?? 0;

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DomeHeader(
                  small: true,
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
                  child: DomeTitle(
                    title: 'Application review',
                    subtitle: tenant['name'] as String? ?? 'Your organisation',
                    onBack: () => context.go('/lender/home'),
                  ),
                ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(18, 20, 18, 32),
                    children: [
                      if (rejected)
                        _ReviewNote(
                          note: note,
                          rejectionCount: rejectionCount,
                        ),
                      if (!rejected)
                        _InfoPanel(
                          message:
                              'Your application is already in the review queue.',
                        ),
                      const SizedBox(height: 16),
                      if (!rejected) _DetailsCard(tenant: tenant),
                      _ReviewTimeline(
                        events: history,
                        rejectionCount: rejectionCount,
                      ),
                      const SizedBox(height: 16),
                      if (rejected) _EditableApplicationForm(
                        formKey: _formKey,
                        nameCtrl: _nameCtrl,
                        emailCtrl: _emailCtrl,
                        addressCtrl: _addressCtrl,
                        tpinCtrl: _tpinCtrl,
                        contactCtrl: _contactCtrl,
                        descriptionCtrl: _descriptionCtrl,
                        nrcCtrl: _nrcCtrl,
                        businessType: _businessType,
                        onBusinessTypeChanged: (value) {
                          setState(() => _businessType = value);
                        },
                        bozFile: _bozFile,
                        onPickBoz: () async {
                          final picked = await FilePicker.pickFile(
                            type: FileType.custom,
                            allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
                          );
                          if (picked != null && mounted) {
                            setState(() => _bozFile = picked);
                          }
                        },
                        error: _error,
                        submitting: _submitting,
                        onResubmit: _resubmit,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _EditableApplicationForm extends StatelessWidget {
  const _EditableApplicationForm({
    required this.formKey,
    required this.nameCtrl,
    required this.emailCtrl,
    required this.addressCtrl,
    required this.tpinCtrl,
    required this.contactCtrl,
    required this.descriptionCtrl,
    required this.nrcCtrl,
    required this.businessType,
    required this.onBusinessTypeChanged,
    required this.bozFile,
    required this.onPickBoz,
    required this.error,
    required this.submitting,
    required this.onResubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController nameCtrl;
  final TextEditingController emailCtrl;
  final TextEditingController addressCtrl;
  final TextEditingController tpinCtrl;
  final TextEditingController contactCtrl;
  final TextEditingController descriptionCtrl;
  final TextEditingController nrcCtrl;
  final String businessType;
  final ValueChanged<String> onBusinessTypeChanged;
  final PlatformFile? bozFile;
  final VoidCallback onPickBoz;
  final String? error;
  final bool submitting;
  final VoidCallback onResubmit;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.card,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.line),
          boxShadow: AppShadows.sh1,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
                          Text('Resubmit for review', style: AppText.cardTitle),
                          const SizedBox(height: 8),
                          Text(
                            'Correct any business details below, then resubmit. You may replace the BOZ certificate, but it is optional.',
                            style: AppText.paragraph.copyWith(
                              color: AppColors.muted,
                            ),
                          ),
                          const SizedBox(height: 16),
                          _FormSectionLabel('Business information'),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'Business name *',
                            controller: nameCtrl,
                            textCapitalization: TextCapitalization.words,
                            validator: (value) =>
                                value == null || value.trim().length < 2
                                ? 'Enter the registered business name.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          Text('Business type *', style: AppText.fieldLabel),
                          const SizedBox(height: 6),
                          DropdownButtonFormField<String>(
                            value: businessType,
                            decoration: InputDecoration(
                              filled: true,
                              fillColor: Colors.white,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(
                                  AppRadii.input,
                                ),
                                borderSide: const BorderSide(
                                  color: AppColors.line2,
                                  width: 1.5,
                                ),
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(
                                value: 'sacco',
                                child: Text('SACCO / Cooperative'),
                              ),
                              DropdownMenuItem(
                                value: 'mfi',
                                child: Text('Microfinance Institution'),
                              ),
                              DropdownMenuItem(
                                value: 'individual_lender',
                                child: Text('Individual Lender'),
                              ),
                              DropdownMenuItem(
                                value: 'other',
                                child: Text('Other'),
                              ),
                            ],
                            onChanged: (value) {
                              if (value != null) {
                                onBusinessTypeChanged(value);
                              }
                            },
                          ),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'Business email *',
                            controller: emailCtrl,
                            keyboardType: TextInputType.emailAddress,
                            validator: Validators.email,
                          ),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'Physical address',
                            controller: addressCtrl,
                            textCapitalization: TextCapitalization.sentences,
                          ),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'TPIN *',
                            controller: tpinCtrl,
                            keyboardType: TextInputType.number,
                            validator: (value) =>
                                value == null || value.trim().isEmpty
                                ? 'TPIN is required.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'Contact person *',
                            controller: contactCtrl,
                            textCapitalization: TextCapitalization.words,
                            validator: (value) =>
                                value == null || value.trim().length < 3
                                ? 'Enter the contact person.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'Business description *',
                            controller: descriptionCtrl,
                            maxLines: 3,
                            textCapitalization: TextCapitalization.sentences,
                            validator: (value) =>
                                value == null || value.trim().length < 20
                                ? 'Enter at least 20 characters about the business.'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          _FormSectionLabel('Contact identity'),
                          const SizedBox(height: 12),
                          AppField(
                            label: 'Contact person NRC *',
                            controller: nrcCtrl,
                            hint: '245711/63/1',
                            keyboardType: TextInputType.number,
                            inputFormatters: [NrcInputFormatter()],
                            validator: Validators.nrc,
                          ),
                          const SizedBox(height: 12),
                          AppUploadRow(
                            title: 'Replace BOZ certificate (optional)',
                            subtitle: bozFile?.name ??
                                'Tap to attach PDF, JPG or PNG',
                            onTap: onPickBoz,
                            tone: bozFile == null
                                ? TileTone.blue
                                : TileTone.green,
                            status: bozFile == null
                                ? UploadStatus.idle
                                : UploadStatus.done,
                          ),
                          if (error != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              error!,
                              style: AppText.paragraph.copyWith(
                                color: AppColors.redInk,
                              ),
                            ),
                          ],
                          const SizedBox(height: 20),
                          AppButton(
                            label: 'Resubmit application',
                            tone: AppButtonTone.green,
                            onPressed: onResubmit,
                            busy: submitting,
                          ),
          ],
        ),
      ),
    );
  }
}

class _FormSectionLabel extends StatelessWidget {
  const _FormSectionLabel(this.label);
  final String label;

  @override
  Widget build(BuildContext context) => Text(
    label,
    style: AppText.eyebrowInk,
  );
}

class _ReviewNote extends StatelessWidget {
  const _ReviewNote({required this.note, required this.rejectionCount});
  final String? note;
  final int rejectionCount;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.red50,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.redLine),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.redInk),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Changes requested',
                    style: AppText.cardTitle.copyWith(color: AppColors.redInk),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    note?.trim().isNotEmpty == true
                        ? note!
                        : 'The reviewer requested changes to this application.',
                    style: AppText.paragraph.copyWith(color: AppColors.redInk),
                  ),
                  if (rejectionCount > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Rejection attempt ' + rejectionCount.toString(),
                      style: AppText.fine.copyWith(color: AppColors.redInk),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      );
}

class _InfoPanel extends StatelessWidget {
  const _InfoPanel({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.amber50,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.amberLine),
        ),
        child: Text(message, style: AppText.paragraph),
      );
}

class _ReviewTimeline extends StatelessWidget {
  const _ReviewTimeline({
    required this.events,
    required this.rejectionCount,
  });

  final List<Map<String, dynamic>> events;
  final int rejectionCount;

  String _title(String action) => switch (action) {
        'registered' => 'Application created',
        'evidence_submitted' => 'Evidence attached',
        'application_updated' => 'Application updated',
        'resubmitted' => 'Resubmitted for review',
        'approved' => 'Application approved',
        'rejected' => 'Changes requested',
        'status_changed' => 'Account status changed',
        _ => action.replaceAll('_', ' '),
      };

  String _date(dynamic value) {
    final parsed = value is String ? DateTime.tryParse(value)?.toLocal() : null;
    if (parsed == null) return 'Date unavailable';
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return parsed.day.toString() + ' ' + months[parsed.month - 1] + ' ' + parsed.year.toString();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Review history', style: AppText.cardTitle),
              const Spacer(),
              if (rejectionCount > 0)
                Text(
                  rejectionCount.toString() + ' rejection' +
                      (rejectionCount == 1 ? '' : 's'),
                  style: AppText.fine.copyWith(color: AppColors.redInk),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (events.isEmpty)
            Text('No review activity has been recorded yet.', style: AppText.paragraph)
          else
            ...events.map((event) {
              final action = event['action'] as String? ?? '';
              final note = event['note'] as String?;
              final actor = event['actor'] is Map
                  ? Map<String, dynamic>.from(event['actor'] as Map)
                  : null;
              final changes = event['changes'] is Map
                  ? Map<String, dynamic>.from(event['changes'] as Map)
                  : null;
              final fields = changes?['fields'] is List
                  ? List<String>.from(changes!['fields'] as List)
                  : const <String>[];
              final isRejected = action == 'rejected';
              final isApproved = action == 'approved';
              final iconColor = isRejected
                  ? AppColors.redInk
                  : isApproved
                  ? AppColors.green700
                  : AppColors.blue600;
              return Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isRejected
                            ? AppColors.red50
                            : isApproved
                            ? AppColors.green50
                            : AppColors.blue50,
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        isRejected
                            ? Icons.close_rounded
                            : isApproved
                            ? Icons.check_rounded
                            : Icons.history_rounded,
                        size: 17,
                        color: iconColor,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _title(action),
                            style: AppText.paragraph.copyWith(
                              fontWeight: FontWeight.w700,
                              color: iconColor,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _date(event['createdAt']) +
                                (actor?['name'] is String
                                    ? ' - ' + (actor!['name'] as String)
                                    : ''),
                            style: AppText.fine,
                          ),
                          if (note?.trim().isNotEmpty == true) ...[
                            const SizedBox(height: 4),
                            Text(note!, style: AppText.paragraph),
                          ],
                          if (fields.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              'Updated: ' + fields.join(', '),
                              style: AppText.fine,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _DetailsCard extends StatelessWidget {
  const _DetailsCard({required this.tenant});
  final Map<String, dynamic> tenant;

  @override
  Widget build(BuildContext context) {
    final fields = <(String, String)>[
      ('Business name', tenant['name'] as String? ?? 'Not provided'),
      ('Business type', tenant['type'] as String? ?? 'Not provided'),
      ('Contact person', tenant['contactPerson'] as String? ?? 'Not provided'),
      ('TPIN', tenant['tpin'] as String? ?? 'Not provided'),
      (
        'Business description',
        tenant['businessDescription'] as String? ?? 'Not provided',
      ),
      ('Email', tenant['email'] as String? ?? 'Not provided'),
      ('Address', tenant['address'] as String? ?? 'Not provided'),
    ];
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(AppRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Application details', style: AppText.cardTitle),
          const SizedBox(height: 8),
          ...fields.map(
            (field) => Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: Text(field.$1, style: AppText.fine)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      field.$2,
                      textAlign: TextAlign.right,
                      style: AppText.paragraph,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
