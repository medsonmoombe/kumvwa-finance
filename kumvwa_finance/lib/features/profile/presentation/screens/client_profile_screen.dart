import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/client_dome_header.dart';
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
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            // Dome scrolls with content — avatar centred inside
            ClientDomeHeader(
              title: name,
              subtitle: 'Borrower · ${cleared > 0 ? '$cleared cleared' : 'Building trust'}',
              bottom: Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white.withValues(alpha: 0.18),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.5),
                        width: 2.5,
                      ),
                    ),
                    child: Text(
                      Fmt.initials(name),
                      style: const TextStyle(
                        fontSize: 23,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
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
                      _SectionItem(icon: Icons.person_outline_rounded, label: 'Role', value: 'Borrower', showDivider: false),
                    ],
                  ),
                  const SizedBox(height: 12),
                  _Section(
                    title: 'More',
                    items: [
                      _SectionItem(icon: Icons.people_outline_rounded, label: 'My lenders', onTap: () => _soon(context, 'My lenders')),
                      _SectionItem(icon: Icons.description_outlined, label: 'Terms of Service', onTap: () => _soon(context, 'Terms of Service')),
                      _SectionItem(icon: Icons.privacy_tip_outlined, label: 'Privacy Policy', onTap: () => _soon(context, 'Privacy Policy'), showDivider: false),
                    ],
                  ),
                  const SizedBox(height: 20),
                  _SignOutButton(ref: ref),
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

class _SignOutButton extends ConsumerWidget {
  const _SignOutButton({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context, WidgetRef widgetRef) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () async {
          final ok = await showDialog<bool>(
            context: context,
            builder: (ctx) => AlertDialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadii.sheet),
              ),
              title: const Text('Sign out?'),
              content: const Text(
                'You will need to sign in again to access your account.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.red,
                  ),
                  child: const Text('Sign Out'),
                ),
              ],
            ),
          );
          if (ok == true) {
            await widgetRef.read(authControllerProvider.notifier).logout();
          }
        },
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.red50,
            borderRadius: BorderRadius.circular(AppRadii.card),
            border: Border.all(color: AppColors.redLine),
          ),
          child: Row(
            children: [
              const Icon(Icons.logout_rounded, size: 17, color: AppColors.red),
              const SizedBox(width: 10),
              Text(
                'Sign Out',
                style: AppText.rowTitle.copyWith(color: AppColors.redInk),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
