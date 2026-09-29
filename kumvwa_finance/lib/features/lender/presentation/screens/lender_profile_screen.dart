import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/widgets/app_button.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

class LenderProfileScreen extends ConsumerStatefulWidget {
  const LenderProfileScreen({super.key});

  @override
  ConsumerState<LenderProfileScreen> createState() => _LenderProfileScreenState();
}

class _LenderProfileScreenState extends ConsumerState<LenderProfileScreen> {
  String? _tenantStatus;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    try {
      final response = await ref.read(apiClientProvider).getA('/tenants/me');
      if (mounted) setState(() => _tenantStatus = (response.data as Map<String, dynamic>)['status'] as String?);
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
                            borderRadius:
                                BorderRadius.circular(AppRadii.chooser),
                          ),
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : 'O',
                            style: AppText.sheetTitle.copyWith(
                              color: Colors.white,
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
                        showDivider: false,
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
                  const SizedBox(height: 24),

                  AppButton(
                    label: 'Sign out',
                    tone: AppButtonTone.ghost,
                    onPressed: () {
                      ref.read(authControllerProvider.notifier).logout();
                      context.go('/login');
                    },
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
    required this.value,
    this.showDivider = true,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
          child: Row(
            children: [
              Icon(icon, size: 16, color: AppColors.muted),
              const SizedBox(width: 10),
              Text(label, style: AppText.rowSub),
              const Spacer(),
              Text(value, style: AppText.rowTitle),
            ],
          ),
        ),
        if (showDivider)
          const Divider(height: 1, indent: 14, color: AppColors.line2),
      ],
    );
  }
}
