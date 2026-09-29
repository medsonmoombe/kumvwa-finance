import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

/// Pre-login invite entry: a client types the short code their lender gave
/// them, sees WHO invited them (verified via the public lookup), then
/// continues to the account-creation form.
class InviteCodeScreen extends ConsumerStatefulWidget {
  const InviteCodeScreen({super.key});

  @override
  ConsumerState<InviteCodeScreen> createState() => _InviteCodeScreenState();
}

class _InviteCodeScreenState extends ConsumerState<InviteCodeScreen> {
  final _codeCtrl = TextEditingController();
  bool _checking = false;
  String? _error;
  ClientInvite? _invite;

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  /// Normalises whatever the user typed: uppercase, separators stripped.
  /// "kmv 7xq4p" → "KMV-7XQ4P" (canonical server form).
  String get _normalized {
    final raw = _codeCtrl.text.trim().toUpperCase().replaceAll(
      RegExp(r'[\s-]'),
      '',
    );
    if (raw.isEmpty) return '';
    final body = raw.startsWith('KMV') ? raw.substring(3) : raw;
    return body.isEmpty ? 'KMV-' : 'KMV-$body';
  }

  Future<void> _lookup() async {
    final code = _normalized;
    if (code.length < 5) {
      setState(() => _error = 'Enter the full code from your lender');
      return;
    }
    setState(() {
      _checking = true;
      _error = null;
      _invite = null;
    });
    try {
      final invite = await ref.read(inviteRepositoryProvider).getByCode(code);
      setState(() {
        _checking = false;
        _invite = invite;
      });
    } on InviteException catch (e) {
      setState(() {
        _checking = false;
        _error = e.message;
      });
    } catch (_) {
      setState(() {
        _checking = false;
        _error = 'Cannot reach the server. Check your connection.';
      });
    }
  }

  void _continue() {
    if (_invite == null) return;
    context.push('/invite/${_invite!.code}');
  }

  @override
  Widget build(BuildContext context) {
    final invite = _invite;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/register/client'),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: AppColors.green50,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.password_outlined,
                  size: 28,
                  color: AppColors.green700,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Have an invite code?',
                style: GoogleFonts.poppins(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Your lender gives you a code like KMV-7XQ4P. '
                'Enter it below to create your account.',
                style: AppText.subText.copyWith(height: 1.55),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _codeCtrl,
                textCapitalization: TextCapitalization.characters,
                autofocus: true,
                enabled: invite == null && !_checking,
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                  if (_invite != null) setState(() => _invite = null);
                },
                onSubmitted: (_) => _lookup(),
                decoration: InputDecoration(
                  labelText: 'Invite code',
                  hintText: 'KMV-7XQ4P',
                  errorText: _error,
                  filled: true,
                  prefixIcon: const Icon(Icons.key_outlined, size: 20),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(14),
                    borderSide: BorderSide.none,
                  ),
                ),
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2.5,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 20),
              if (invite == null)
                ElevatedButton(
                  onPressed: _checking ? null : _lookup,
                  child: _checking
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2.4),
                        )
                      : const Text('Verify Code'),
                )
              else ...[
                // Who invited whom — verified against the server before the
                // client commits any personal data.
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.green50,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFBFE9D2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(
                            Icons.verified_user_outlined,
                            size: 18,
                            color: AppColors.green700,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              '${invite.businessName} invited '
                              '${invite.clientName}',
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Color(0xFF155C39),
                              ),
                            ),
                          ),
                        ],
                      ),
                      if ((invite.phoneMasked ?? '').isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          'For the phone ending ${invite.phoneMasked}',
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: Color(0xFF3D7A5C),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: _continue,
                  child: const Text('Create My Account'),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _invite = null;
                    _codeCtrl.clear();
                  }),
                  child: const Text('Use a different code'),
                ),
              ],
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
