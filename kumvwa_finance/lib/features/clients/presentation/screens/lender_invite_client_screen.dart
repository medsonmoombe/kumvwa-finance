import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';
import 'package:kumvwa_finance/core/widgets/client_dome_header.dart';
import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

/// Lender-side client onboarding — the mobile equivalent of the console's
/// "New client" dialog.
///
/// Two steps on one screen: capture who the borrower is, then hand them a code.
/// The invite is created server-side on submit, so the code shown afterwards is
/// always one the API minted — nothing is generated on-device, and a failed
/// create never shows a code that would not resolve.
class LenderInviteClientScreen extends ConsumerStatefulWidget {
  const LenderInviteClientScreen({super.key});

  @override
  ConsumerState<LenderInviteClientScreen> createState() =>
      _LenderInviteClientScreenState();
}

class _LenderInviteClientScreenState
    extends ConsumerState<LenderInviteClientScreen> {
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  bool _busy = false;
  String? _error;

  /// A `402 CLIENT_LIMIT` is not a generic failure: the lender has run out of
  /// paid places. It gets its own state so the screen can say what happened and
  /// what to do, instead of the API's message, which is written for the
  /// console's billing page.
  bool _atCapacity = false;
  String? _capacityMessage;

  ClientInvite? _created;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  /// Deliberately permissive: the API is the authority on email validity, and
  /// the invite is delivered by email — there is no SMS channel yet — so this
  /// only guards against an obviously empty/typo'd address.
  static final _emailRe = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

  bool get _canSubmit =>
      _nameCtrl.text.trim().length >= 2 &&
      _phoneCtrl.text.trim().length >= 9 &&
      _emailRe.hasMatch(_emailCtrl.text.trim()) &&
      !_busy;

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
      _atCapacity = false;
      _capacityMessage = null;
    });
    try {
      final invite = await ref.read(inviteRepositoryProvider).createInvite(
            clientName: _nameCtrl.text,
            phone: _phoneCtrl.text,
            email: _emailCtrl.text,
          );
      if (!mounted) return;
      setState(() {
        _busy = false;
        _created = invite;
      });
    } on InviteException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        // The repository already flattens API errors to human text, so the
        // capacity case is detected on the message the same way the console
        // does — the code is not carried through InviteException.
        if (_looksLikeCapacity(e.message)) {
          _atCapacity = true;
          _capacityMessage = e.message;
        } else {
          _error = e.message;
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = 'Could not create the invite. Try again.';
      });
    }
  }

  static bool _looksLikeCapacity(String message) {
    final m = message.toLowerCase();
    return m.contains('client limit') ||
        m.contains('client places') ||
        m.contains('client slot');
  }

  void _reset() => setState(() {
        _created = null;
        _error = null;
        _atCapacity = false;
        _capacityMessage = null;
        _nameCtrl.clear();
        _phoneCtrl.clear();
        _emailCtrl.clear();
      });

  @override
  Widget build(BuildContext context) {
    final created = _created;
    if (created != null) return _InviteCreated(invite: created, onAddAnother: _reset);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClientDomeHeader(
              title: 'Add a client',
              subtitle: 'Send them a code to sign up',
              onBack: _pop,
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 32),
                children: [
                  if (_atCapacity) ...[
                    _CapacityNotice(message: _capacityMessage),
                    const SizedBox(height: 14),
                  ] else if (_error != null) ...[
                    _ErrorNotice(message: _error!),
                    const SizedBox(height: 14),
                  ],
                  AppTextField(
                    label: 'Full name',
                    controller: _nameCtrl,
                    hint: 'e.g. Chileshe Mwape',
                    textInputAction: TextInputAction.next,
                    enabled: !_busy,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 14),
                  _PhoneField(
                    controller: _phoneCtrl,
                    enabled: !_busy,
                    onChanged: () => setState(() {}),
                  ),
                  const SizedBox(height: 14),
                  AppTextField(
                    label: 'Email address',
                    controller: _emailCtrl,
                    hint: 'e.g. mwansa@example.com',
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.done,
                    enabled: !_busy,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'They will use this number to sign in. The invite is sent to '
                    'their email — you can also share the code directly.',
                    style: AppText.fine,
                  ),
                  const SizedBox(height: 20),
                  AppButton(
                    label: 'Create invite',
                    icon: Icons.person_add_alt_1_rounded,
                    busy: _busy,
                    expand: true,
                    onPressed: _canSubmit ? _submit : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _pop() {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).maybePop();
    } else {
      context.go('/lender/clients');
    }
  }
}

/// Invite-code hand-off.
///
/// The code is the product here, so it gets the largest type on the screen and
/// a tap-to-copy affordance, plus native share. A lender is usually reading
/// this number out over the phone or pasting it into WhatsApp.
class _InviteCreated extends StatelessWidget {
  const _InviteCreated({required this.invite, required this.onAddAnother});

  final ClientInvite invite;
  final VoidCallback onAddAnother;

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: invite.code));
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invite code copied')),
      );
    }
  }

  Future<void> _share() async {
    final link = invite.link;
    final body = link == null || link.isEmpty
        ? 'Your invite code is ${invite.code}'
        : 'Join ${invite.businessName} on Kumvwa Finance. '
            'Use invite code ${invite.code}: $link';
    await SharePlus.instance.share(ShareParams(text: body));
  }

  Future<void> _openLink(BuildContext context) async {
    final link = invite.link;
    if (link == null || link.isEmpty) return;
    final uri = Uri.tryParse(link);
    if (uri == null) return;
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open that link')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ClientDomeHeader(
              title: 'Invite ready',
              subtitle: 'Share the code with your client',
              onBack: () => Navigator.of(context).maybePop(),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 4, 18, 32),
                children: [
                  Center(
                    child: Container(
                      width: 74,
                      height: 74,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.green50,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.mark_email_read_rounded,
                        size: 34,
                        color: AppColors.green700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    invite.clientName,
                    style: AppText.cardTitle.copyWith(fontSize: 18),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'has a place reserved. They complete their profile in the app.',
                    style: AppText.paragraph.copyWith(color: AppColors.muted),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 22),
                  _CodeBlock(code: invite.code, onCopy: () => _copy(context)),
                  const SizedBox(height: 18),
                  AppButton(
                    label: 'Share invite',
                    icon: Icons.ios_share_rounded,
                    expand: true,
                    onPressed: () => _share(),
                  ),
                  if ((invite.link ?? '').isNotEmpty) ...[
                    const SizedBox(height: 10),
                    AppButton(
                      label: 'Open link',
                      icon: Icons.open_in_new_rounded,
                      tone: AppButtonTone.outline,
                      expand: true,
                      onPressed: () => _openLink(context),
                    ),
                  ],
                  const SizedBox(height: 10),
                  AppButton(
                    label: 'Invite another client',
                    tone: AppButtonTone.ghost,
                    expand: true,
                    onPressed: onAddAnother,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CodeBlock extends StatelessWidget {
  const _CodeBlock({required this.code, required this.onCopy});

  final String code;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onCopy,
      borderRadius: BorderRadius.circular(AppRadii.card),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadii.card),
          border: Border.all(color: AppColors.blueLine, width: 1.5),
        ),
        child: Column(
          children: [
            Text(
              'INVITE CODE',
              style: AppText.eyebrowInk,
            ),
            const SizedBox(height: 8),
            // Wide tracking: an unspaced code is easy to misread aloud.
            Text(
              code,
              textAlign: TextAlign.center,
              style: AppText.heroNumber.copyWith(
                fontSize: 30,
                letterSpacing: 2,
                color: AppColors.blue600,
              ),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.copy_rounded,
                  size: 14,
                  color: AppColors.muted,
                ),
                const SizedBox(width: 5),
                Text('Tap to copy', style: AppText.fine),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Lender is out of paid client places.
///
/// This is a billing limit, not a validation error, so it is styled as an
/// information panel with a route to billing rather than a red error. The fix
/// requires money to change and only the console's billing page can take that,
/// so the button says so honestly rather than routing to a screen that cannot
/// act on it.
class _CapacityNotice extends StatelessWidget {
  const _CapacityNotice({this.message});

  final String? message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.amber50,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.amberLine),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.workspace_premium_outlined,
            size: 20,
            color: AppColors.amberInk,
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'No client places left',
                  style: AppText.rowTitle,
                ),
                const SizedBox(height: 3),
                Text(
                  message ??
                      'Your plan has no unused client places. Buy an extra '
                          'place on the web console to invite more clients.',
                  style: AppText.rowSub,
                ),
                const SizedBox(height: 9),
                Text(
                  'Billing is managed in the Kumvwa console.',
                  style: AppText.fine,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorNotice extends StatelessWidget {
  const _ErrorNotice({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: AppColors.red50,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.redLine),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 19,
            color: AppColors.redInk,
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(message, style: AppText.rowSub)),
        ],
      ),
    );
  }
}

class _PhoneField extends StatelessWidget {
  const _PhoneField({
    required this.controller,
    required this.enabled,
    required this.onChanged,
  });

  final TextEditingController controller;
  final bool enabled;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return AppTextField(
      label: 'Phone number',
      controller: controller,
      hint: 'e.g. 097 000 0000',
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.done,
      enabled: enabled,
      onChanged: (_) => onChanged(),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s-]'))],
      suffixIcon: const Padding(
        padding: EdgeInsets.only(right: 12),
        child: Text('+260', style: TextStyle(fontSize: 13, color: AppColors.muted)),
      ),
    );
  }
}
