import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/app_checkbox.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';

/// Platform terms gate — blocks the home screen until the borrower accepts
/// the current version. A user who cannot retain the contract is holding a
/// weak one, so a versioned PDF download sits next to the scrollable body.
class TermsGateScreen extends ConsumerStatefulWidget {
  const TermsGateScreen({super.key});

  @override
  ConsumerState<TermsGateScreen> createState() => _TermsGateScreenState();
}

class _TermsGateScreenState extends ConsumerState<TermsGateScreen> {
  var _agreed = false;
  var _submitting = false;

  Future<void> _accept() async {
    setState(() => _submitting = true);
    try {
      await ref
          .read(apiClientProvider)
          .postA('/terms/accept', data: {'scope': 'platform_client'});
      // Re-run the gate: termsAccepted flips true and the home shows.
      ref.invalidate(clientGateProvider);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _submitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not record acceptance — try again.'),
          ),
        );
      }
    }
  }

  /// Public endpoint — opens in the browser/PDF viewer, no bearer needed.
  /// [launchUrl] mode: externalApplication so the PDF opens in the system
  /// viewer instead of an in-app webview download fight.
  Future<void> _download() async {
    final uri = Uri.parse('${Env.apiBaseUrl}/terms/platform.pdf');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open the PDF viewer.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final gate = ref.watch(clientGateProvider).valueOrNull;
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: const Text('Terms of Service'),
        actions: [
          TextButton.icon(
            onPressed: _download,
            icon: const Icon(Icons.download_outlined, size: 17),
            label: const Text('Download PDF', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Version ${gate?.termsVersion ?? 1}',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.muted,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.line),
                      ),
                      child: Text(
                        (gate?.termsBody.isNotEmpty ?? false)
                            ? gate!.termsBody
                            : 'Loading…',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.ink2,
                          height: 1.6,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 20),
              child: Column(
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppCheckbox(
                        checked: _agreed,
                        onChanged: (v) => setState(() => _agreed = v),
                      ),
                      const SizedBox(width: 9),
                      const Expanded(
                        child: Text(
                          'I have read and accept the Kumvwa Finance Terms of '
                          'Service and Privacy Policy.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.ink2,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: (_agreed && !_submitting) ? _accept : null,
                      child: _submitting
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.4,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Accept & Continue'),
                    ),
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
