import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:kumvwa_finance/core/network/api_client.dart';
import 'package:kumvwa_finance/core/network/api_exception.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/theme/app_effects.dart';
import 'package:kumvwa_finance/core/theme/app_text.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/core/widgets/dome_header.dart';
import 'package:kumvwa_finance/features/auth/presentation/auth_controller.dart';

String _money(String minor) =>
    Fmt.money((int.tryParse(minor) ?? 0) / 100);

class LenderHomeScreen extends ConsumerStatefulWidget {
  const LenderHomeScreen({super.key});

  @override
  ConsumerState<LenderHomeScreen> createState() => _LenderHomeScreenState();
}

class _LenderHomeScreenState extends ConsumerState<LenderHomeScreen> {
  Map<String, dynamic>? _summary;
  String? _error;
  bool _underReview = false;
  String? _tenantStatus;
  String? _verificationNote;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final client = ref.read(apiClientProvider);
      final tenant = await client.getA('/tenants/me');
      final tenantData = tenant.data as Map<String, dynamic>;
      final status = tenantData['status'] as String? ?? 'pending_verification';
      if (status != 'active') {
        setState(() {
          _tenantStatus = status;
          _verificationNote = tenantData['verificationNote'] as String?;
          _underReview = true;
          _loading = false;
        });
        return;
      }
      final res = await client.getA('/reports/summary');
      setState(() {
        _tenantStatus = status;
        _underReview = false;
        _summary = res.data as Map<String, dynamic>;
        _loading = false;
      });
    } on DioException catch (e) {
      final apiErr = ApiException.fromDio(e);
      final is403 = e.response?.statusCode == 403;
      final msg = apiErr.message.toLowerCase();
      setState(() {
        _underReview = is403 &&
            (msg.contains('role') ||
                msg.contains('verif') ||
                msg.contains('review') ||
                msg.contains('pending'));
        _error = _underReview ? null : apiErr.message;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final name = session?.displayName ?? 'Organisation';

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(
                  color: AppColors.blue600,
                  strokeWidth: 2,
                ),
              )
            : _underReview
            ? _UnderReviewBody(name: name, status: _tenantStatus ?? 'pending_verification', note: _verificationNote, onRetry: _load)
            : _error != null
            ? _ErrorBody(message: _error!, onRetry: _load, name: name)
            : _Body(summary: _summary!, name: name),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.summary, required this.name});

  final Map<String, dynamic> summary;
  final String name;

  @override
  Widget build(BuildContext context) {
    final counts = summary['counts'] as Map<String, dynamic>? ?? {};
    final outstanding = summary['outstandingMinor'] as String? ?? '0';
    final clientsCount = summary['clientsCount'] as int? ?? 0;
    final recentLoans =
        (summary['recentLoans'] as List? ?? []).cast<Map<String, dynamic>>();

    return RefreshIndicator(
      color: AppColors.blue600,
      onRefresh: () async {},
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          // Dome scrolls with content
          DomeHeader(
            small: true,
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 44),
            child: DomeTitle(
              title: name,
              subtitle: 'Lender overview',
              trailing: IconButton(
                onPressed: () => context.push('/lender/alerts'),
                icon: const Icon(
                  Icons.notifications_outlined,
                  color: Colors.white,
                  size: 22,
                ),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 96),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Stats strip — single row, 4 tiles
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.card,
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    border: Border.all(color: AppColors.line),
                    boxShadow: AppShadows.sh1,
                  ),
                  child: IntrinsicHeight(
                    child: Row(
                      children: [
                        _StatTile(label: 'Outstanding', value: _money(outstanding), valueColor: AppColors.blue600),
                        _VertDivider(),
                        _StatTile(label: 'Active', value: '${counts['active'] ?? 0}', valueColor: AppColors.green700),
                        _VertDivider(),
                        _StatTile(label: 'Overdue', value: '${counts['overdue'] ?? 0}', valueColor: AppColors.red),
                        _VertDivider(),
                        _StatTile(label: 'Clients', value: '$clientsCount'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    gradient: AppGradients.brand,
                    borderRadius: BorderRadius.circular(AppRadii.card),
                    boxShadow: AppShadows.sh2,
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.open_in_browser_rounded,
                          color: Colors.white, size: 20),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Full dashboard in console',
                              style: AppText.cardTitle.copyWith(color: Colors.white),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Approve requests, manage products & view reports.',
                              style: AppText.fine
                                  .copyWith(color: AppColors.onGradientSub),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              if (recentLoans.isNotEmpty) ...[
                Text('Recent loans', style: AppText.cardTitle),
                const SizedBox(height: 10),
                ...recentLoans.map((loan) => _LoanRow(loan: loan, onTap: () => context.push('/lender/loans/${loan['id']}'))),
              ] else
                _EmptyLoans(),
            ],
          ),
        ),
        ],
      ),
    );
  }
}

class _LoanRow extends StatelessWidget {
  const _LoanRow({required this.loan, required this.onTap});

  final Map<String, dynamic> loan;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final status = loan['status'] as String? ?? '';
    final statusColor = status == 'overdue'
        ? AppColors.red
        : status == 'cleared'
        ? AppColors.muted
        : AppColors.green700;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.card),
        child: Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
        boxShadow: AppShadows.sh1,
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.blue50,
              shape: BoxShape.circle,
            ),
            child: Text(
              (loan['clientName'] as String? ?? '?')[0].toUpperCase(),
              style: AppText.cardTitle.copyWith(color: AppColors.blue600),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(loan['clientName'] as String? ?? '', style: AppText.rowTitle),
                const SizedBox(height: 2),
                Text(
                  _money(loan['principalMinor'] as String? ?? '0'),
                  style: AppText.rowSub,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
            child: Text(
              status,
              style: AppText.chipLabel.copyWith(color: statusColor),
            ),
          ),
        ],
      ),
    ),
      ),
    );
  }
}

class _EmptyLoans extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(AppRadii.card),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          const Icon(Icons.receipt_long_outlined, size: 32, color: AppColors.muted),
          const SizedBox(height: 8),
          Text(
            'No loans yet',
            style: AppText.rowTitle.copyWith(color: AppColors.muted),
          ),
          const SizedBox(height: 3),
          Text(
            'Approve a request in the console to get started.',
            style: AppText.fine,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _UnderReviewBody extends StatelessWidget {
  const _UnderReviewBody({required this.name, required this.status, required this.note, required this.onRetry});

  final String name;
  final String status;
  final String? note;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        DomeHeader(
          small: true,
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 44),
          child: DomeTitle(title: name, subtitle: 'Lender overview'),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 40, 32, 40),
          child: Column(
            children: [
              Container(
                width: 72,
                height: 72,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.amber50,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.amberLine, width: 1.5),
                ),
                child: const Icon(
                  Icons.hourglass_top_rounded,
                  size: 34,
                  color: AppColors.amber,
                ),
              ),
              const SizedBox(height: 20),
              Text(
                status == 'rejected' ? 'Verification needs attention' : status == 'suspended' ? 'Account suspended' : 'Under Review',
                style: AppText.cardTitle.copyWith(fontSize: 17),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Your organisation is being verified by the Kumvwa team. '
                'This usually takes 1–2 business days.',
                style: AppText.paragraph.copyWith(color: AppColors.muted),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              _ReviewStep(
                icon: Icons.mark_email_read_outlined,
                label: "You'll receive a notification once approved",
              ),
              const SizedBox(height: 10),
              _ReviewStep(
                icon: Icons.verified_outlined,
                label: 'BOZ certificate & NRC are being checked',
              ),
              const SizedBox(height: 10),
              _ReviewStep(
                icon: Icons.dashboard_outlined,
                label: 'Full console access unlocks on approval',
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(13),
                decoration: BoxDecoration(
                  color: AppColors.amber50,
                  borderRadius: BorderRadius.circular(AppRadii.card),
                  border: Border.all(color: AppColors.amberLine),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline_rounded,
                        size: 16, color: AppColors.amberInk),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Questions? Email support@kumvwa.com',
                        style: AppText.paragraph.copyWith(color: AppColors.amberInk),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value, this.valueColor = AppColors.ink});

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 13, horizontal: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Text(
              label,
              style: AppText.statLabel,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: AppText.statValue.copyWith(color: valueColor),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _VertDivider extends StatelessWidget {
  @override
  Widget build(BuildContext context) =>
      const VerticalDivider(width: 1, color: AppColors.line2);
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.blue50,
            borderRadius: BorderRadius.circular(AppRadii.sm),
          ),
          child: Icon(icon, size: 17, color: AppColors.blue600),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(label, style: AppText.paragraph),
        ),
      ],
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry, required this.name});

  final String message;
  final VoidCallback onRetry;
  final String name;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        DomeHeader(
          small: true,
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 44),
          child: DomeTitle(title: name, subtitle: 'Lender overview'),
        ),
        Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.cloud_off_rounded, size: 44, color: AppColors.muted),
              const SizedBox(height: 12),
              Text(
                'Could not load dashboard',
                style: AppText.rowTitle,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(message, style: AppText.fine, textAlign: TextAlign.center),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: onRetry,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.blue600,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadii.button),
                  ),
                ),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
