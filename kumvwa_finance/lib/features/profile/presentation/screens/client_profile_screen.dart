import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/client_dome_header.dart';
import 'package:kumvwa_finance/core/widgets/danger_action_tile.dart';
import 'package:kumvwa_finance/core/widgets/profile_image_picker.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';

class ClientProfileScreen extends ConsumerWidget {
  const ClientProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;
    final name = session?.displayName ?? 'Borrower';
    final phone = session?.phone ?? '';
    final loans = ref.watch(clientLoansProvider).valueOrNull ?? [];
    final cleared = loans.where((l) => l.status.name == 'cleared').length;
    final totalBorrowed = loans.fold<double>(0, (s, l) => s + l.principal);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.blue600,
          onRefresh: () async {
            ref.invalidate(clientLoansProvider);
          },
          child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.zero,
          children: [
            // Dome scrolls with content — avatar centred inside
            ClientDomeHeader(
              title: name,
              subtitle: 'Borrower · ${cleared > 0 ? '$cleared cleared' : 'Building trust'}',
              bottom: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Center(
                  child: ProfileImagePicker(
                    name: name,
                    imageUrl: session?.profileImageUrl,
                    uploadBasePath: '/files/client',
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Stats strip
                  Container(
                    margin: const EdgeInsets.only(top: 14, bottom: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.line2),
                      boxShadow: AppShadows.sh2Deep,
                    ),
                    child: IntrinsicHeight(
                      child: Row(
                        children: [
                          _StatCell(label: 'Loans', value: '${loans.length}'),
                          const _StatDivider(),
                          _StatCell(label: 'On-time', value: cleared > 0 ? '100%' : '—'),
                          const _StatDivider(),
                          _StatCell(
                            label: 'Borrowed',
                            value: totalBorrowed > 0 ? Fmt.money(totalBorrowed) : '—',
                          ),
                        ],
                      ),
                    ),
                  ),
                  _Section(
                    title: 'Account',
                    items: [
                      _SectionItem(icon: Icons.phone_rounded, label: 'Phone', value: phone),
                      const _SectionItem(icon: Icons.person_outline_rounded, label: 'Role', value: 'Borrower', showDivider: false),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _Section(
                    title: 'More',
                    items: [
                      // Receipts live here as well as on the loan screens: this
                      // is where a borrower goes when they want "what have I
                      // paid", not "which loan is it going against".
                      _SectionItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'Payment receipts',
                        onTap: () => context.push('/c/payments'),
                      ),
                      // Platform legal documents are lender-facing for now —
                      // they live on the lender profile, not here.
                      _SectionItem(
                        icon: Icons.people_outline_rounded,
                        label: 'My lenders',
                        onTap: () => _soon(context, 'My lenders'),
                        showDivider: false,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  // Its own block, clearly destructive — not another row in
                  // the list above.
                  DangerActionTile(
                    label: 'Sign out',
                    description: 'You will need your phone number and password to sign back in.',
                    onConfirm: () async {
                      await ref.read(authControllerProvider.notifier).logout();
                    },
                  ),
                  const SizedBox(height: 20),
                  Center(
                    child: FutureBuilder<PackageInfo>(
                      future: PackageInfo.fromPlatform(),
                      builder: (_, snap) => Text(
                        'Kumvwa Finance · v${snap.data?.version ?? '-'}',
                        style: AppText.fine,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        ),
      ),
    );
  }

  void _soon(BuildContext context, String what) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$what coming soon'),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.card),
        ),
      ),
    );
  }
}

// Stats strip cells — matches HTML .stats > div
class _StatCell extends StatelessWidget {
  const _StatCell({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) => Expanded(
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 13),
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: AppText.statLabel,
          ),
          const SizedBox(height: 3),
          Text(value, style: AppText.statValue),
        ],
      ),
    ),
  );
}

class _StatDivider extends StatelessWidget {
  const _StatDivider();
  @override
  Widget build(BuildContext context) =>
      Container(width: 1, color: AppColors.line2);
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.items});

  final String title;
  final List<Widget> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
        boxShadow: AppShadows.sh1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 8),
            child: Text(title.toUpperCase(), style: AppText.eyebrowInk),
          ),
          const Divider(height: 1, color: AppColors.line2),
          ...items,
        ],
      ),
    );
  }
}

class _SectionItem extends StatelessWidget {
  const _SectionItem({
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.showDivider = true,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final row = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.muted),
          const SizedBox(width: 10),
          Text(label, style: AppText.rowSub),
          const Spacer(),
          if (value != null)
            Text(value!, style: AppText.rowTitle)
          else
            const Icon(
              Icons.chevron_right_rounded,
              size: 16,
              color: AppColors.muted,
            ),
        ],
      ),
    );

    return Column(
      children: [
        onTap != null
            ? InkWell(
                onTap: onTap,
                borderRadius: showDivider
                    ? BorderRadius.zero
                    : const BorderRadius.only(
                        bottomLeft: Radius.circular(AppRadii.card),
                        bottomRight: Radius.circular(AppRadii.card),
                      ),
                child: row,
              )
            : row,
        if (showDivider)
          const Divider(height: 1, indent: 14, color: AppColors.line2),
      ],
    );
  }
}
