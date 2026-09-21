import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

class ClientProfileScreen extends ConsumerWidget {
  const ClientProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            Container(
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: Row(
                children: [
                  Container(
                    width: 54,
                    height: 54,
                    alignment: Alignment.center,
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [AppColors.green500, AppColors.green700],
                      ),
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      Fmt.initials(session?.displayName ?? 'K'),
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          session?.displayName ?? 'Borrower',
                          style: GoogleFonts.poppins(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.ink,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          session?.phone ?? '',
                          style: const TextStyle(
                              fontSize: 11.5, color: AppColors.muted),
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppColors.green50,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: const Text(
                            'Verified borrower',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.green700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 11),
            _tile(Icons.people_outline, 'My lenders',
                () => _soon(context, 'My lenders')),
            _tile(Icons.description_outlined, 'Terms of Service',
                () => _soon(context, 'Terms of Service')),
            _tile(Icons.privacy_tip_outlined, 'Privacy Policy',
                () => _soon(context, 'Privacy Policy')),
            const SizedBox(height: 11),
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16)),
                leading: const Icon(Icons.logout, color: AppColors.red),
                title: const Text(
                  'Log Out',
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.red,
                  ),
                ),
                onTap: () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18)),
                      title: const Text('Log out?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, false),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          style: TextButton.styleFrom(
                              foregroundColor: AppColors.red),
                          child: const Text('Log Out'),
                        ),
                      ],
                    ),
                  );
                  if (ok == true) {
                    await ref
                        .read(authControllerProvider.notifier)
                        .logout();
                  }
                },
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child: FutureBuilder<PackageInfo>(
                future: PackageInfo.fromPlatform(),
                builder: (_, snap) => Text(
                  'Kumvwa Finance · Version ${snap.data?.version ?? '—'}',
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.muted),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String label, VoidCallback? onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: ListTile(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        leading: Icon(icon, size: 20, color: AppColors.ink2),
        title: Text(label,
            style: const TextStyle(
                fontSize: 13.5, fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right,
            size: 20, color: AppColors.muted),
        onTap: onTap,
      ),
    );
  }

  void _soon(BuildContext context, String what) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$what — coming soon')),
    );
  }
}
