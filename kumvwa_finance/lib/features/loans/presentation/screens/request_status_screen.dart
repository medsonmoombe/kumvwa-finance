import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/utils/format.dart';
import 'package:kumvwa_finance/features/loans/data/loan_requests_repository.dart';
import 'package:kumvwa_finance/features/loans/data/loans_repository.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';

/// Borrower-facing status of one loan application. It is the landing target
/// for trace bullets and every "View status" entry point across the app.
/// Mirrors the approved / rejected / pending status screens in the UI
/// mockups (medal, headline, receipt, advice and action rows).
class RequestStatusScreen extends ConsumerWidget {
  const RequestStatusScreen({super.key, required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = ref.watch(loanRequestByIdProvider(requestId));

    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
      ),
      body: request.when(
        loading: () => const Center(
          child: SizedBox(
            width: 26,
            height: 26,
            child: CircularProgressIndicator(strokeWidth: 2.5),
          ),
        ),
        error: (_, _) => _ErrorView(requestId: requestId),
        data: (r) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 6, 16, 32),
          children: [
            switch (r.status) {
              LoanRequestStatus.pending => _PendingView(request: r),
              LoanRequestStatus.approved => _ApprovedView(request: r),
              LoanRequestStatus.rejected => _RejectedView(request: r),
            },
          ],
        ),
      ),
    );
  }
}

class _ErrorView extends ConsumerWidget {
  const _ErrorView({required this.requestId});

  final String requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return ListView(
      children: [
        const SizedBox(height: 90),
        const Center(child: Text('Could not load this application')),
        const SizedBox(height: 14),
        Center(
          child: ElevatedButton(
            onPressed: () => ref.invalidate(loanRequestByIdProvider(requestId)),
            child: const Text('Retry'),
          ),
        ),
      ],
    );
  }
}

// ---------- shared chrome ----------

/// 82px tinted disc with a 52px solid inner disc carrying the status icon —
/// the mockup's "medal" that sits above every status headline.
class _Medal extends StatelessWidget {
  const _Medal({required this.outer, required this.solid, required this.icon});

  final Color outer;
  final Color solid;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 82,
        height: 82,
        decoration: BoxDecoration(color: outer, shape: BoxShape.circle),
        child: Center(
          child: Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: solid,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: solid.withValues(alpha: 0.28),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(icon, size: 24, color: Colors.white),
          ),
        ),
      ),
    );
  }
}

class _HeroTitle extends StatelessWidget {
  const _HeroTitle(this.text, {this.inlineIcon});

  final String text;
  final IconData? inlineIcon;

  @override
  Widget build(BuildContext context) {
    final style = GoogleFonts.poppins(
      fontSize: 19,
      fontWeight: FontWeight.w700,
      color: AppColors.ink,
    );
    final span = TextSpan(
      text: text,
      style: style,
      children: [
        if (inlineIcon != null)
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: const EdgeInsets.only(left: 7),
              child: Icon(inlineIcon, size: 20, color: AppColors.amber),
            ),
          ),
      ],
    );
    return Text.rich(span, textAlign: TextAlign.center);
  }
}

class _HeroSub extends StatelessWidget {
  const _HeroSub(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      textAlign: TextAlign.center,
      style: const TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w500,
        color: AppColors.muted,
        height: 1.5,
      ),
    );
  }
}

class _Receipt extends StatelessWidget {
  const _Receipt({required this.rows});

  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 1, color: AppColors.line),
            _ReceiptRow(label: rows[i].$1, value: rows[i].$2),
          ],
        ],
      ),
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.muted,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w700,
                color: AppColors.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.label,
    required this.onPressed,
    this.color = AppColors.blue600,
    this.trailing,
  });

  final String label;
  final VoidCallback onPressed;
  final Color color;
  final IconData? trailing;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: color,
          foregroundColor: Colors.white,
          textStyle: GoogleFonts.poppins(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: trailing == null
            ? Text(label)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label),
                  const SizedBox(width: 6),
                  Icon(trailing, size: 17),
                ],
              ),
      ),
    );
  }
}

class _GhostButton extends StatelessWidget {
  const _GhostButton({required this.label, required this.onPressed});

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          elevation: 0,
          backgroundColor: Colors.white,
          foregroundColor: AppColors.ink2,
          side: const BorderSide(color: AppColors.line, width: 1.5),
          textStyle: GoogleFonts.poppins(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: Text(label),
      ),
    );
  }
}

// ---------- Pending ----------

class _PendingView extends StatelessWidget {
  const _PendingView({required this.request});

  final LoanRequest request;

  @override
  Widget build(BuildContext context) {
    final period =
        '${request.termInstallments} '
        'month${request.termInstallments == 1 ? '' : 's'}';
    return Column(
      children: [
        const SizedBox(height: 4),
        const _Medal(
          outer: AppColors.amber50,
          solid: AppColors.amber,
          icon: Icons.hourglass_top_rounded,
        ),
        const SizedBox(height: 12),
        const _HeroTitle('Under Review'),
        const SizedBox(height: 6),
        _HeroSub(
          '${request.lenderName} is reviewing your application. '
          'Most decisions take a few hours.',
        ),
        const SizedBox(height: 22),
        _Receipt(
          rows: [
            ('Amount', Fmt.money(request.amount, decimals: 2)),
            ('Period', period),
            (
              'Submitted',
              DateFormat('d MMM yyyy · HH:mm').format(request.requestedAt),
            ),
          ],
        ),
        const SizedBox(height: 26),
        _ApplicationTimeline(request: request),
        const SizedBox(height: 4),
        _GhostButton(
          label: 'Back to Home',
          onPressed: () => context.go('/c/home'),
        ),
      ],
    );
  }
}

class _ApplicationTimeline extends StatelessWidget {
  const _ApplicationTimeline({required this.request});

  final LoanRequest request;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _TimelineNode(
          icon: Icons.check_rounded,
          tile: AppColors.green50,
          fg: AppColors.green700,
          title: 'Application submitted',
          caption: DateFormat('d MMM · HH:mm').format(request.requestedAt),
          connector: true,
        ),
        const _TimelineNode(
          icon: Icons.hourglass_top_rounded,
          tile: AppColors.blue50,
          fg: AppColors.blue600,
          title: 'Lender reviewing',
          caption: 'Typically within a few hours',
          active: true,
          connector: true,
        ),
        const _TimelineNode(
          icon: Icons.schedule_rounded,
          tile: AppColors.line,
          fg: AppColors.muted,
          title: 'Decision',
          caption: "You'll get an alert the moment they decide",
        ),
      ],
    );
  }
}

class _TimelineNode extends StatelessWidget {
  const _TimelineNode({
    required this.icon,
    required this.tile,
    required this.fg,
    required this.title,
    required this.caption,
    this.active = false,
    this.connector = false,
  });

  final IconData icon;
  final Color tile;
  final Color fg;
  final String title;
  final String caption;
  final bool active;

  /// Draws the 2px rail segment linking this node to the one below.
  final bool connector;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: tile,
                  shape: BoxShape.circle,
                  boxShadow: active
                      ? [
                          BoxShadow(
                            color: AppColors.blue600.withValues(alpha: 0.18),
                            blurRadius: 0,
                            spreadRadius: 5,
                          ),
                        ]
                      : null,
                ),
                child: Icon(icon, size: 18, color: fg),
              ),
              if (connector)
                Container(width: 2, height: 22, color: AppColors.line),
            ],
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.ink,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    caption,
                    style: const TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: AppColors.muted,
                    ),
                  ),
                  if (connector) const SizedBox(height: 10),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------- Approved ----------

class _ApprovedView extends ConsumerWidget {
  const _ApprovedView({required this.request});

  final LoanRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final loan = request.loanId == null || request.loanId!.isEmpty
        ? null
        : ref.watch(loanByIdProvider(request.loanId!)).valueOrNull;

    final rows = loan == null
        ? <(String, String)>[
            ('Amount', Fmt.money(request.amount, decimals: 2)),
            (
              'Term',
              '${request.termInstallments} '
                  'month${request.termInstallments == 1 ? '' : 's'}',
            ),
            (
              'Reviewed',
              request.reviewedAt == null
                  ? 'Just now'
                  : Fmt.date(request.reviewedAt!),
            ),
          ]
        : () {
            final interest = (loan.totalDue - loan.principal).clamp(
              0.0,
              double.infinity,
            );
            final repayBy = loan.schedule.isNotEmpty
                ? loan.schedule.last.dueDate
                : request.reviewedAt ?? request.requestedAt;
            return <(String, String)>[
              ('Loan amount', Fmt.money(loan.principal, decimals: 2)),
              (
                'Interest (${_pctLabel(loan.interestRatePct)})',
                Fmt.money(interest, decimals: 2),
              ),
              ('Total to repay', Fmt.money(loan.totalDue, decimals: 2)),
              ('Repay by', Fmt.date(repayBy)),
              ('Lender', loan.lenderName),
            ];
          }();

    return Column(
      children: [
        const SizedBox(height: 4),
        const _Medal(
          outer: AppColors.green50,
          solid: AppColors.green500,
          icon: Icons.check_rounded,
        ),
        const SizedBox(height: 12),
        const _HeroTitle('Loan Approved!', inlineIcon: Icons.celebration),
        const SizedBox(height: 6),
        _HeroSub(
          '${request.lenderName} approved your application. '
          'The money is ready — your loan is now active.',
        ),
        const SizedBox(height: 22),
        _Receipt(rows: rows),
        const SizedBox(height: 26),
        _PrimaryButton(
          label: 'View My Loan',
          color: AppColors.green500,
          trailing: Icons.arrow_forward_rounded,
          onPressed: () {
            final id = request.loanId;
            if (id != null && id.isNotEmpty) {
              context.push('/c/loan/$id');
            } else {
              context.push('/c/history');
            }
          },
        ),
        const SizedBox(height: 10),
        _GhostButton(
          label: 'Back to Home',
          onPressed: () => context.go('/c/home'),
        ),
      ],
    );
  }
}

String _pctLabel(double value) {
  final whole = value.roundToDouble();
  return value == whole ? '${value.round()}%' : '$value%';
}

// ---------- Rejected ----------

class _RejectedView extends ConsumerWidget {
  const _RejectedView({required this.request});

  final LoanRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cap = ref
        .watch(
          creditLimitProvider((
            clientId: request.clientId,
            lenderId: request.lenderId,
          )),
        )
        .valueOrNull;
    final approved = (cap != null && cap.limitKwacha > 0)
        ? Fmt.money(cap.limitKwacha)
        : null;
    final feedback = request.feedback?.trim();

    return Column(
      children: [
        const SizedBox(height: 4),
        const _Medal(
          outer: AppColors.red50,
          solid: AppColors.red,
          icon: Icons.close_rounded,
        ),
        const SizedBox(height: 12),
        const _HeroTitle('Application Declined'),
        const SizedBox(height: 6),
        _HeroSub(
          "${request.lenderName} couldn't approve this request. "
          "This doesn't affect your standing with other lenders.",
        ),
        if (feedback != null && feedback.isNotEmpty) ...[
          const SizedBox(height: 22),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.red50,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFF3C6C8)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Lender's feedback",
                  style: GoogleFonts.poppins(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.1,
                    color: const Color(0xFFC03538),
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  feedback,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.ink,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 26),
        const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.lightbulb_outline_rounded,
              size: 20,
              color: AppColors.blue600,
            ),
            SizedBox(width: 8),
            Text(
              'What you can do',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: AppColors.ink,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        _Tip(
          number: '1',
          title: approved == null
              ? 'Apply for a smaller amount next time'
              : "Apply for a smaller amount — you're still approved for "
                    '$approved',
        ),
        const SizedBox(height: 12),
        const _Tip(
          number: '2',
          title: 'Repay an active loan to grow your limit',
        ),
        const SizedBox(height: 12),
        _Tip(
          number: '3',
          title:
              'Contact ${request.lenderName} if you believe this is a mistake',
        ),
        const SizedBox(height: 26),
        _PrimaryButton(
          label: approved == null ? 'Apply for a loan' : 'Apply for $approved',
          onPressed: () => context.push('/c/request'),
        ),
        const SizedBox(height: 10),
        _GhostButton(
          label: 'Back to Home',
          onPressed: () => context.go('/c/home'),
        ),
      ],
    );
  }
}

class _Tip extends StatelessWidget {
  const _Tip({required this.number, required this.title});

  final String number;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: const BoxDecoration(
            color: AppColors.blue50,
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Text(
            number,
            style: GoogleFonts.poppins(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: AppColors.blue600,
            ),
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.ink,
              height: 1.45,
            ),
          ),
        ),
      ],
    );
  }
}
