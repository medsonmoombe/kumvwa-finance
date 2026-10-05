import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/danger_action_tile.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/core/widgets/profile_image_picker.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

class LenderProfileScreen extends ConsumerStatefulWidget {
  const LenderProfileScreen({super.key});

  @override
  ConsumerState<LenderProfileScreen> createState() => _LenderProfileScreenState();
}

class _LenderProfileScreenState extends ConsumerState<LenderProfileScreen> {
  String? _tenantStatus;
  String? _businessDescription;
  String? _logoUrl;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    try {
      final api = ref.read(apiClientProvider);
      final response = await api.getA('/tenants/me');
      final branding = await api.getA('/tenants/me/branding');
      if (mounted) {
        final tenant = response.data as Map<String, dynamic>;
        setState(() {
          _tenantStatus = tenant['status'] as String?;
          _businessDescription = tenant['businessDescription'] as String?;
          _logoUrl = (branding.data as Map<String, dynamic>)['logoUrl'] as String?;
        });
      }
    } catch (_) {
      // The session remains usable offline; status is simply omitted until the next refresh.
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final name = session?.displayName ?? 'Organisation';
    final phone = session?.phone ?? '';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.blue600,
          onRefresh: _loadStatus,
          child: ListView(
          padding: EdgeInsets.zero,
          children: [
            // Dome scrolls with content
            DomeHeader(
              small: true,
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 44),
              child: DomeTitle(
                title: 'Profile',
                subtitle: name,
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 96),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Org card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.line),
                      boxShadow: AppShadows.sh2,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            gradient: AppGradients.brand,
                            borderRadius: BorderRadius.circular(AppRadii.chooser),
                          ),
                          child: _logoUrl == null
                              ? Text(
                                  name.isNotEmpty ? name[0].toUpperCase() : 'O',
                                  style: AppText.sheetTitle.copyWith(color: Colors.white),
                                )
                              : ClipRRect(
                                  borderRadius: BorderRadius.circular(AppRadii.chooser),
                                  child: Image.network(
                                    _logoUrl!,
                                    width: 52,
                                    height: 52,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name, style: AppText.cardTitle),
                              const SizedBox(height: 3),
                              Text(phone, style: AppText.rowSub),
                            ],
                          ),
                        ),
                        _VerificationBadge(status: _tenantStatus),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Info rows
                  _InfoSection(
                    title: 'Account',
                    rows: [
                      _InfoRow(
                        icon: Icons.phone_rounded,
                        label: 'Phone',
                        value: phone,
                      ),
                      _InfoRow(
                        icon: Icons.business_rounded,
                        label: 'Role',
                        value: 'Lender',
                        showDivider:
                            _businessDescription?.trim().isNotEmpty == true,
                      ),
                      if (_businessDescription?.trim().isNotEmpty == true)
                        _InfoRow(
                          icon: Icons.description_outlined,
                          label: 'Business description',
                          value: _businessDescription!,
                          showDivider: false,
                          multiline: true,
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  _InfoSection(
                    title: 'Personal profile',
                    rows: [
                      Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            ProfileImagePicker(
                              name: name,
                              imageUrl: session?.profileImageUrl,
                              uploadBasePath: '/files',
                              size: 54,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Tap your photo to update your personal profile image.',
                                style: AppText.paragraph.copyWith(color: AppColors.muted),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Console nudge
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppColors.blue50,
                      borderRadius: BorderRadius.circular(AppRadii.card),
                      border: Border.all(color: AppColors.blueLine),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.info_outline_rounded,
                            size: 18, color: AppColors.blue600),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Manage branding, staff access, loan products and full settings in the web console.',
                            style: AppText.paragraph.copyWith(
                              color: AppColors.blue600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Platform legal documents. Lender-facing for now: these are
                  // the terms of the service the lender's business runs on, and
                  // the privacy policy covering the data it processes here.
                  _InfoSection(
                    title: 'Legal',
                    rows: [
                      _InfoRow(
                        icon: Icons.description_outlined,
                        label: 'Terms of Service',
                        onTap: () => context.push('/legal/terms'),
                      ),
                      _InfoRow(
                        icon: Icons.privacy_tip_outlined,
                        label: 'Privacy Policy',
                        onTap: () => context.push('/legal/privacy'),
                        showDivider: false,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),

                  // Same component the borrower profile uses, so signing out
                  // looks and behaves identically on both sides. The previous
                  // ghost button had no confirmation step at all. Navigation is
                  // left to the router, which redirects on the auth change.
                  DangerActionTile(
                    label: 'Sign out',
                    description: 'Staff and lending tools are managed in Kumvwa Console.',
                    onConfirm: () async {
                      await ref.read(authControllerProvider.notifier).logout();
                    },
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
}

class _VerificationBadge extends StatelessWidget {
  const _VerificationBadge({this.status});
  final String? status;

  @override
  Widget build(BuildContext context) {
    final active = status == 'active';
    final rejected = status == 'rejected' || status == 'suspended';
    final color = active ? AppColors.green700 : rejected ? AppColors.red : AppColors.amber;
    final background = active ? AppColors.green50 : rejected ? AppColors.red50 : AppColors.amber50;
    final border = active ? AppColors.green500.withValues(alpha: 0.35) : rejected ? AppColors.redLine : AppColors.amberLine;
    final label = active ? 'Active' : rejected ? (status == 'suspended' ? 'Suspended' : 'Rejected') : 'Pending';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            label,
            style: AppText.chipLabel.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  const _InfoSection({required this.title, required this.rows});

  final String title;
  final List<Widget> rows;

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
            child: Text(
              title.toUpperCase(),
              style: AppText.eyebrowInk,
            ),
          ),
          const Divider(height: 1, color: AppColors.line2),
          ...rows,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.showDivider = true,
    this.multiline = false,
  });

  final IconData icon;
  final String label;

  /// Trailing text. Omit it on a navigable row — [onTap] rows show a chevron
  /// instead, the way every other push affordance in the app reads.
  final String? value;

  /// Makes the whole row tappable (e.g. pushing a legal document).
  final VoidCallback? onTap;
  final bool showDivider;
  final bool multiline;

  @override
  Widget build(BuildContext context) {
    final Widget content = multiline
        ? Padding(
            padding: const EdgeInsets.fromLTRB(14, 11, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(icon, size: 16, color: AppColors.muted),
                    const SizedBox(width: 10),
                    Text(label, style: AppText.rowSub),
                  ],
                ),
                const SizedBox(height: 7),
                Padding(
                  padding: const EdgeInsets.only(left: 26),
                  child: Text(
                    value ?? '',
                    style: AppText.paragraph.copyWith(color: AppColors.ink),
                  ),
                ),
              ],
            ),
          )
        : Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            child: Row(
              children: [
                Icon(icon, size: 16, color: AppColors.muted),
                const SizedBox(width: 10),
                Text(label, style: AppText.rowSub),
                const Spacer(),
                if (value != null)
                  Flexible(
                    child: Text(
                      value!,
                      textAlign: TextAlign.right,
                      style: AppText.rowTitle,
                    ),
                  )
                else if (onTap != null)
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
        if (onTap != null)
          InkWell(
            onTap: onTap,
            borderRadius: showDivider
                ? BorderRadius.zero
                : const BorderRadius.only(
                    bottomLeft: Radius.circular(AppRadii.card),
                    bottomRight: Radius.circular(AppRadii.card),
                  ),
            child: content,
          )
        else
          content,
        if (showDivider)
          const Divider(height: 1, indent: 14, color: AppColors.line2),
      ],
    );
  }
}
