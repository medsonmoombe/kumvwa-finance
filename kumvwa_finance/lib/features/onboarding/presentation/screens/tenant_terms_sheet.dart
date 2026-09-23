import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:kumvwa_finance/core/config/env.dart';
import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/features/auth/presentation/client_gate.dart';

/// Per-lender terms sheet. A lender can republish their lending terms; the
/// home screen shows an amber card for each unaccepted lender, which opens
/// this sheet — body, versioned PDF download, and an explicit accept.
Future<void> showTenantTermsSheet(
  BuildContext context,
  WidgetRef ref,
  LenderStatus lender,
) async {
  // Public endpoint: latest published terms + branding for this lender.
  Map<String, dynamic>? terms;
  try {
    final res = await ref
        .read(apiClientProvider)
        .getPublic('/tenants/${lender.tenantId}/public-info');
    final data = res.data as Map<String, dynamic>;
    terms = (data['terms'] as Map<String, dynamic>?);
  } on ApiException catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
    return;
  }

  if (!context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetCtx) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.85,
      builder: (_, scrollCtrl) => _Sheet(
        scrollCtrl: scrollCtrl,
        lender: lender,
        body: terms?['body'] as String? ?? 'No terms published yet.',
        version: terms?['version'] as int?,
      ),
    ),
  );

  // Accepted (or dismissed) — re-check so the amber card drops off.
  ref.invalidate(clientGateProvider);
}

class _Sheet extends ConsumerWidget {
  const _Sheet({
    required this.scrollCtrl,
    required this.lender,
    required this.body,
    required this.version,
  });

  final ScrollController scrollCtrl;
  final LenderStatus lender;
  final String body;
  final int? version;

  Future<void> _accept(BuildContext context, WidgetRef ref) async {
    try {
      await ref
          .read(apiClientProvider)
          .postA('/terms/accept', data: {
        'scope': 'tenant',
        'tenantId': lender.tenantId,
      });
      if (context.mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: AppColors.line,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          Text(
            '${lender.name} — Lending Terms',
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
          ),
          Text(
            'Version ${version ?? '—'}',
            style: const TextStyle(fontSize: 11, color: AppColors.muted),
          ),
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => launchUrl(
                Uri.parse(
                  '${Env.apiBaseUrl}/terms/tenant/${lender.tenantId}/pdf',
                ),
                mode: LaunchMode.externalApplication,
              ),
              icon: const Icon(Icons.download_outlined, size: 16),
              label: const Text('Download PDF'),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: SingleChildScrollView(
              controller: scrollCtrl,
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.bg,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.line),
                ),
                child: Text(
                  body,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.ink2,
                    height: 1.6,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.green500,
            ),
            onPressed: () => _accept(context, ref),
            child: const Text('I Accept These Terms'),
          ),
        ],
      ),
    );
  }
}
