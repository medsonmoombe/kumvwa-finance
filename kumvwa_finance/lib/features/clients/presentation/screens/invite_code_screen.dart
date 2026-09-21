import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_text_field.dart';

/// Fallback for borrowers who tapped "Client (Borrower)" on onboarding
/// instead of opening the invite link directly.
class InviteCodeScreen extends StatefulWidget {
  const InviteCodeScreen({super.key});

  @override
  State<InviteCodeScreen> createState() => _InviteCodeScreenState();
}

class _InviteCodeScreenState extends State<InviteCodeScreen> {
  final _codeCtrl = TextEditingController();

  @override
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  void _continue() {
    final code = _codeCtrl.text.trim().toUpperCase();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter the invite code from your lender')),
      );
      return;
    }
    context.push('/invite/$code');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Container(
                width: 60,
                height: 60,
                decoration: BoxDecoration(
                  color: AppColors.green50,
                  borderRadius: BorderRadius.circular(18),
                ),
                child: const Icon(
                  Icons.link,
                  size: 28,
                  color: AppColors.green700,
                ),
              ),
              const SizedBox(height: 18),
              Text(
                'Join via invite',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              Text(
                'Kumvwa Finance is lender-led: your lender creates an invite '
                'for you. Enter the code from your invite link below.',
                style: AppText.subText.copyWith(height: 1.55),
              ),
              const SizedBox(height: 24),
              AppTextField(
                label: 'Invite code',
                controller: _codeCtrl,
                hint: 'e.g. INV1000',
                textInputAction: TextInputAction.done,
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _continue,
                child: const Text('Continue'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
