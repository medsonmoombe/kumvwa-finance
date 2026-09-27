import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
import 'package:kumvwa_finance/features/auth/presentation/lender_branding.dart';
import 'package:kumvwa_finance/features/loans/domain/loan.dart';
import 'package:kumvwa_finance/features/loans/domain/loan_request.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/client_loan_card.dart';
import 'package:kumvwa_finance/features/loans/presentation/widgets/loan_request_card.dart';

/// The cards are dense by design, so the real risk is a RenderFlex overflow on
/// a narrow phone. `flutter analyze` cannot see that; these tests can.
///
/// Note that `flutter test` substitutes a font whose every glyph is a full em
/// square, so text here measures roughly 1.7x its real width. A card that
/// clears these assertions at 320dp has genuine slack on a real device, and
/// the Flexible/ellipsis paths are exercised for real.
Loan _loan({
  required LoanStatus status,
  required List<(int, InstallmentStatus)> schedule,
  double principal = 455,
  double total = 569,
  double paid = 190,
  String lender = 'Chilenje Community SACCO',
}) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final per = total / schedule.length;

  return Loan(
    id: 'LN-2025-00841',
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
          amount: per,
          status: schedule[i].$2,
        ),
    ],
  );
}

LoanRequest _request({required LoanRequestStatus status, String? feedback}) =>
    LoanRequest(
      id: 'REQ-1002',
      clientId: 'clt_001',
      clientName: 'Mwansa Bwalya',
      nrc: '245711/63/1',
      phone: '0971112233',
      lenderId: 'biz_001',
      lenderName: 'Chilenje Community SACCO and Savings Group Limited',
      amount: 4000,
      termInstallments: 3,
      purpose: 'Restock shop inventory ahead of the festive season',
      requestedAt: DateTime.now().subtract(const Duration(hours: 5)),
      status: status,
      feedback: feedback,
    );

/// Pumps at a deliberately narrow width (iPhone SE class). Branding is
/// overridden to an empty map so the card never reaches for a live session.
Future<void> _pump(WidgetTester tester, Widget child) async {
  tester.view.physicalSize = const Size(320, 900);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [lenderBrandingProvider.overrideWithValue(const {})],
      child: MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ),
    ),
  );
}

void main() {
  group('ClientLoanCard', () {
    testWidgets('active loan states the balance against what was borrowed', (
      tester,
    ) async {
      await _pump(
        tester,
        ClientLoanCard(
          loan: _loan(
            status: LoanStatus.active,
            schedule: const [
              (-30, InstallmentStatus.paid),
              (18, InstallmentStatus.due),
              (48, InstallmentStatus.upcoming),
            ],
          ),
        ),
      );

      expect(find.textContaining('borrowed K 455'), findsOneWidget);
      expect(find.textContaining('of K 569'), findsOneWidget);
      expect(find.text('K 379'), findsOneWidget); // outstanding hero
      expect(find.text('Active'), findsOneWidget);
      expect(find.textContaining('in 18 days'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('overdue loan leads with the overdue day count', (
      tester,
    ) async {
      await _pump(
        tester,
        ClientLoanCard(
          loan: _loan(
            status: LoanStatus.overdue,
            schedule: const [
              (-45, InstallmentStatus.paid),
              (-6, InstallmentStatus.overdue),
              (24, InstallmentStatus.upcoming),
            ],
          ),
        ),
      );

      expect(find.text('Overdue'), findsOneWidget);
      expect(find.textContaining('6 days overdue'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('cleared loan drops the countdown for a settled line', (
      tester,
    ) async {
      await _pump(
        tester,
        ClientLoanCard(
          loan: _loan(
            status: LoanStatus.cleared,
            total: 4600,
            principal: 4000,
            paid: 4600,
            schedule: const [
              (-60, InstallmentStatus.paid),
              (-30, InstallmentStatus.paid),
              (-3, InstallmentStatus.paid),
            ],
          ),
        ),
      );

      expect(find.text('Cleared'), findsOneWidget);
      expect(find.text('Repaid in full'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('a long lender name ellipsizes instead of overflowing', (
      tester,
    ) async {
      await _pump(
        tester,
        ClientLoanCard(
          loan: _loan(
            status: LoanStatus.active,
            lender: 'Chilenje Community SACCO and Savings Group Limited',
            schedule: const [
              (18, InstallmentStatus.due),
              (48, InstallmentStatus.upcoming),
            ],
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });
  });

  group('LoanRequestCard', () {
    testWidgets('pending application labels the amount and request date', (
      tester,
    ) async {
      await _pump(
        tester,
        LoanRequestCard(
          request: _request(status: LoanRequestStatus.pending),
          titleName: 'Chilenje Community SACCO and Savings Group Limited',
        ),
      );

      expect(find.text('K 4,000'), findsOneWidget);
      expect(find.text('Pending'), findsOneWidget);
      expect(find.textContaining('Requested '), findsOneWidget);
      expect(find.textContaining('3 installments'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('declined application shows the lender feedback block', (
      tester,
    ) async {
      await _pump(
        tester,
        LoanRequestCard(
          request: _request(
            status: LoanRequestStatus.rejected,
            feedback:
                'We can only lend up to K 5,000 to first-time '
                'borrowers. Reapply for a lower amount.',
          ),
          titleName: 'Zamuka Savings & Credit',
        ),
      );

      expect(find.text('Declined'), findsOneWidget);
      expect(find.text('Lender feedback'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
