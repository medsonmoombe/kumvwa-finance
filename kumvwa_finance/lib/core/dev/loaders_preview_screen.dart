import 'package:flutter/material.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/core/theme/app_colors.dart';
import 'package:kumvwa_finance/core/widgets/app_loader.dart';
import 'package:kumvwa_finance/core/widgets/skeleton.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/client_loan_card.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/loan_request_card.dart';

/// TEMPORARY dev screen to preview loaders/skeletons/cards.
/// Remove in Phase 6/7 once real screens consume them.
class LoadersPreviewScreen extends StatelessWidget {
  const LoadersPreviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Loaders & Cards (dev)')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'AppLoader',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const Center(child: AppLoader(message: 'Restoring session…')),
          const SizedBox(height: 32),
          const Text(
            'Dashboard skeleton',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const DashboardSkeleton(),
          const SizedBox(height: 32),
          const Text(
            'Clients skeleton',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const ClientsSkeletonList(itemCount: 4),
          const SizedBox(height: 32),
          const Text(
            'Button states',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          const ElevatedButton(onPressed: null, child: Text('Normal')),
          const SizedBox(height: 9),
          const ElevatedButton(onPressed: null, child: ButtonSpinner()),
          const SizedBox(height: 9),
          const ElevatedButton(
            onPressed: null,
            style: ButtonStyle(
              backgroundColor: WidgetStatePropertyAll(AppColors.line),
              foregroundColor: WidgetStatePropertyAll(AppColors.muted),
            ),
            child: Text('Disabled'),
          ),
          const SizedBox(height: 32),
          // Borrower-facing cards, every state. Branding falls back to Kumvwa
          // blue here because there is no live session to resolve lenders.
          const Text(
            'Loan cards: active / overdue / cleared',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          for (final loan in _sampleLoans)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ClientLoanCard(loan: loan),
            ),
          const SizedBox(height: 22),
          const Text(
            'Application cards: pending / declined',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          for (final request in _sampleRequests)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: LoanRequestCard(
                request: request,
                titleName: request.lenderName,
                onTap: () {},
              ),
            ),
        ],
      ),
    );
  }
}

// ---------- dev-only sample data ----------

Loan _sampleLoan({
  required String id,
  required String lender,
  required double principal,
  required double total,
  required double paid,
  required LoanStatus status,
  required List<(int, InstallmentStatus)> schedule,
}) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final per = total / schedule.length;

  return Loan(
    id: id,
    clientId: 'clt_001',
    clientName: 'Mwansa Bwalya',
    lenderName: lender,
    nrc: '245711/63/1',
    principal: principal,
    interestRatePct: 25,
    termInstallments: schedule.length,
    totalDue: total,
    amountPaid: paid,
    status: status,
    schedule: [
      for (var i = 0; i < schedule.length; i++)
        Installment(
          number: i + 1,
          dueDate: today.add(Duration(days: schedule[i].$1)),
          amount: i == schedule.length - 1
              ? total - per * (schedule.length - 1)
              : per,
          status: schedule[i].$2,
        ),
    ],
  );
}

final _sampleLoans = [
  _sampleLoan(
    id: 'LN-2025-00841',
    lender: 'Chilenje Community SACCO',
    principal: 455,
    total: 569,
    paid: 190,
    status: LoanStatus.active,
    schedule: const [
      (-30, InstallmentStatus.paid),
      (18, InstallmentStatus.due),
      (48, InstallmentStatus.upcoming),
    ],
  ),
  _sampleLoan(
    id: 'LN-2025-00836',
    lender: 'Zamuka Savings & Credit',
    principal: 2500,
    total: 2960,
    paid: 900,
    status: LoanStatus.overdue,
    schedule: const [
      (-45, InstallmentStatus.paid),
      (-6, InstallmentStatus.overdue),
      (24, InstallmentStatus.upcoming),
    ],
  ),
  _sampleLoan(
    id: 'LN-2025-00780',
    lender: 'Chilenje Community SACCO',
    principal: 4000,
    total: 4600,
    paid: 4600,
    status: LoanStatus.cleared,
    schedule: const [
      (-60, InstallmentStatus.paid),
      (-30, InstallmentStatus.paid),
      (-3, InstallmentStatus.paid),
    ],
  ),
];

final _sampleRequests = [
  LoanRequest(
    id: 'REQ-1002',
    clientId: 'clt_001',
    clientName: 'Mwansa Bwalya',
    nrc: '245711/63/1',
    phone: '0971112233',
    lenderId: 'biz_001',
    lenderName: 'Chilenje Community SACCO',
    amount: 4000,
    termInstallments: 3,
    purpose: 'Restock shop inventory ahead of the festive season',
    requestedAt: DateTime.now().subtract(const Duration(hours: 5)),
  ),
  LoanRequest(
    id: 'REQ-0998',
    clientId: 'clt_001',
    clientName: 'Mwansa Bwalya',
    nrc: '245711/63/1',
    phone: '0971112233',
    lenderId: 'biz_002',
    lenderName: 'Zamuka Savings & Credit',
    amount: 6000,
    termInstallments: 4,
    purpose: 'School fees for two children',
    requestedAt: DateTime.now().subtract(const Duration(days: 6)),
    status: LoanRequestStatus.rejected,
    feedback:
        'We can only lend up to K 5,000 to first-time borrowers. '
        'Reapply for a lower amount.',
    reviewedAt: DateTime.now().subtract(const Duration(days: 5)),
  ),
];
