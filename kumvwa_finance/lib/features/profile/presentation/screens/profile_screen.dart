import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authControllerProvider).session;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
          children: [
            // ---------- identity card ----------
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
                        colors: [AppColors.blue500, AppColors.blue900],
                      ),
                      shape: BoxShape.circle,
                    ),
                    child: Text(
                      Fmt.initials(session?.displayName ?? 'K'),
                      style: AppText.body.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                session?.displayName ?? 'My Business',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppText.sectionTitle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              width: 16,
                              height: 16,
                              decoration: const BoxDecoration(
                                color: AppColors.green500,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.check,
                                size: 10,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          session?.phone ?? '',
                          style: AppText.subText,
                        ),
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 9,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.green50,
                            borderRadius: BorderRadius.circular(99),
                          ),
                          child: Text(
                            'BOZ Verified',
                            style: AppText.caption.copyWith(
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
            // ---------- settings ----------
            _Group(
              items: [
                _Item(
                  icon: Icons.business_outlined,
                  label: 'Business details',
                  onTap: () => _comingSoon(context, 'Business details'),
                ),
                _Item(
                  icon: Icons.person_add_outlined,
                  label: 'Invite a client',
                  onTap: () => context.push('/clients/add'),
                ),
                const _Item(
                  icon: Icons.notifications_outlined,
                  label: 'Notifications',
                  trailing: _NotificationsToggle(),
                ),
              ],
            ),
            const SizedBox(height: 11),
            _Group(
              items: [
                _Item(
                  icon: Icons.description_outlined,
                  label: 'Terms of Service',
                  onTap: () => _comingSoon(context, 'Terms of Service'),
                ),
                _Item(
                  icon: Icons.privacy_tip_outlined,
                  label: 'Privacy Policy',
                  onTap: () => _comingSoon(context, 'Privacy Policy'),
                ),
              ],
            ),
            const SizedBox(height: 11),
            // ---------- logout ----------
            Container(
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.line),
              ),
              child: ListTile(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                leading: const Icon(Icons.logout, color: AppColors.red),
                title: Text(
                  'Log Out',
                  style: AppText.body.copyWith(
                    color: AppColors.red,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () => _confirmLogout(context, ref),
              ),
            ),
            const SizedBox(height: 24),
            const Center(
              child: _VersionLabel(),
            ),
          ],
        ),
      ),
    );
  }

  void _comingSoon(BuildContext context, String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$feature — coming soon')),
    );
  }

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Text('Log out?'),
        content: const Text(
          'You will need to log in again to access your loan portfolio.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.red),
            child: const Text('Log Out'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authControllerProvider.notifier).logout();
    }
  }
}

// ---------- version label ----------

/// Reads the real version from the platform so it can never drift from
/// pubspec.yaml's `version:`.
class _VersionLabel extends StatelessWidget {
  const _VersionLabel();

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<PackageInfo>(
      future: PackageInfo.fromPlatform(),
      builder: (_, snap) {
        final v = snap.data;
        return Text(
          'Kumvwa Finance · Version ${v?.version ?? '—'} '
          '(${v?.buildNumber ?? '—'})',
          style: AppText.caption,
        );
      },
    );
  }
}

// ---------- settings group ----------

class _Group extends StatelessWidget {
  const _Group({required this.items});

  final List<Widget> items;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            items[i],
            if (i < items.length - 1)
              const Padding(
                padding: EdgeInsets.only(left: 52),
                child: Divider(height: 1, color: AppColors.line),
              ),
          ],
        ],
      ),
    );
  }
}

class _Item extends StatelessWidget {
  const _Item({
    required this.icon,
    required this.label,
    this.onTap,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      shape: const RoundedRectangleBorder(),
      leading: Icon(icon, size: 21, color: AppColors.ink2),
      title: Text(
        label,
        style: AppText.body.copyWith(fontWeight: FontWeight.w600),
      ),
      trailing:
          trailing ??
          const Icon(Icons.chevron_right, size: 20, color: AppColors.muted),
      onTap: onTap,
    );
  }
}

class _NotificationsToggle extends StatefulWidget {
  const _NotificationsToggle();

  @override
  State<_NotificationsToggle> createState() => _NotificationsToggleState();
}

class _NotificationsToggleState extends State<_NotificationsToggle> {
  var _on = true;

  @override
  Widget build(BuildContext context) {
    return Switch(
      value: _on,
      onChanged: (v) => setState(() => _on = v),
      activeThumbColor: Colors.white,
      activeTrackColor: AppColors.green500,
      inactiveThumbColor: Colors.white,
      inactiveTrackColor: const Color(0xFFD6DBE7),
    );
  }
}
