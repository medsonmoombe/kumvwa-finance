import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/validators.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/app_phone_field.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

class AddClientScreen extends ConsumerStatefulWidget {
  const AddClientScreen({super.key});

  @override
  ConsumerState<AddClientScreen> createState() => _AddClientScreenState();
}

class _AddClientScreenState extends ConsumerState<AddClientScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  var _submitting = false;
  String? _error;
  ClientInvite? _created;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final invite = await ref
          .read(inviteRepositoryProvider)
          .createInvite(clientName: _nameCtrl.text, phone: _phoneCtrl.text);
      if (mounted) setState(() => _created = invite);
    } on InviteException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error = 'Could not create the invite. Please try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _copyCode() {
    Clipboard.setData(ClipboardData(text: _created!.code));
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Invite code copied')));
  }

  Future<void> _copyLink() async {
    final link = _created!.link;
    if (link == null || link.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: link));
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Download link copied')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
        title: const Text('Add Client'),
      ),
      body: SafeArea(
        child: _created == null ? _form(context) : _success(context),
      ),
    );
  }

  // ---------- create form ----------

  Widget _form(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Invite a borrower', style: AppText.pageTitle),
            const SizedBox(height: 6),
            const Text(
              "They'll type the invite code in the app to set their name and "
              'password — NRC, address and consent — then appear in your '
              'Clients list.',
              style: AppText.subText,
            ),
            const SizedBox(height: 22),
            AppTextField(
              label: 'Client full name',
              controller: _nameCtrl,
              hint: 'e.g. Mwansa Bwalya',
              textInputAction: TextInputAction.next,
              enabled: !_submitting,
              validator: (v) => Validators.required(v, field: 'Client name'),
            ),
            const SizedBox(height: 11),
            AppPhoneField(
              label: 'Client phone number',
              controller: _phoneCtrl,
              hint: '0971234567',
              enabled: !_submitting,
              validator: (_) => Validators.zmPhone(_phoneCtrl.text),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.red50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFF3C6C8)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline,
                        size: 18, color: AppColors.red),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        _error!,
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFFC03538),
                          height: 1.4,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 22),
            ElevatedButton(
              onPressed: _submitting ? null : _create,
              child: _submitting
                  ? const ButtonSpinner()
                  : const Text('Create Invite Code'),
            ),
          ],
        ),
      ),
    );
  }

  // ---------- success / share ----------

  Widget _success(BuildContext context) {
    final invite = _created!;
    final code = invite.code.isEmpty ? 'KMV-·····' : invite.code.toUpperCase();
    final link = (invite.link ?? '').trim();

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 28, 20, 20),
      child: Column(
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: const BoxDecoration(
              color: AppColors.green50,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_outline,
              size: 38,
              color: AppColors.green700,
            ),
          ),
          const SizedBox(height: 18),
          Text('Invite created', style: AppText.pageTitle),
          const SizedBox(height: 6),
          Text(
            'Share TWO things with ${invite.clientName} '
            '(${invite.phone}): the app download link, and this invite code. '
            'When they claim it, they appear in your Clients list.',
            textAlign: TextAlign.center,
            style: AppText.subText,
          ),
          const SizedBox(height: 20),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 18),
            decoration: BoxDecoration(
              color: AppColors.blue50,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFB9C6E8)),
            ),
            child: Text(
              code,
              textAlign: TextAlign.center,
              style: AppText.subText.copyWith(
                color: AppColors.blue600,
                fontWeight: FontWeight.w800,
                fontSize: 24,
                letterSpacing: 2,
              ),
            ),
          ),
          if (link.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.line),
              ),
              child: Column(
                children: [
                  const Text(
                    'Download the app',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    link,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.blue600,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: _copyCode,
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.blue600,
              side: const BorderSide(color: AppColors.blue600),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(13),
              ),
              minimumSize: const Size.fromHeight(50),
            ),
            icon: const Icon(Icons.copy_outlined, size: 17),
            label: const Text('Copy Invite Code'),
          ),
          const SizedBox(height: 9),
          ElevatedButton(
            onPressed: () => SharePlus.instance.share(
              ShareParams(
                title: 'Kumvwa Finance invite',
                text:
                    "Hi ${invite.clientName}, ${invite.businessName} invited "
                        'you to Kumvwa Finance.\n\n1. Download the app: $link\n'
                        '2. Open the app and enter this invite code: $code',
              ),
            ),
            child: const Text('Share Invite (SMS / WhatsApp)'),
          ),
          if (link.isNotEmpty) ...[
            const SizedBox(height: 9),
            OutlinedButton(
              onPressed: _copyLink,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.ink2,
                side: const BorderSide(color: AppColors.line),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(13),
                ),
                minimumSize: const Size.fromHeight(48),
              ),
              child: const Text('Copy Download Link'),
            ),
          ],
          const SizedBox(height: 9),
          TextButton(
            onPressed: () => context.push('/invite/${invite.code}'),
            child: const Text('Preview invite screen →'),
          ),
          const SizedBox(height: 9),
          TextButton(
            onPressed: () => setState(() {
              _created = null;
              _error = null;
            }),
            child: const Text('Add another client'),
          ),
        ],
      ),
    );
  }
}
