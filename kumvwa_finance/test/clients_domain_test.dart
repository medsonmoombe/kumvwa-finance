import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/core/domain/loan_status.dart';
// NOTE: deliberately not importing core/domain/risk_level.dart — the
// RiskLevel re-export test below depends on client.dart providing it.
import 'package:kumvwa_finance/features/clients/domain/client.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

ClientLoanSummary summary(String id, LoanStatus status) => ClientLoanSummary(
  id: id,
  amount: 100,
  dueDate: DateTime(2025, 8, 12),
  status: status,
);

Client makeClient({
  String id = 'clt_x',
  List<ClientLoanSummary> loans = const [],
  RiskLevel risk = RiskLevel.low,
}) => Client(
  id: id,
  name: 'Test Client',
  nrc: '245711/63/1',
  phone: '0971112233',
  risk: risk,
  lendersCount: 1,
  loans: loans,
);

void main() {
  group('Client.hasActiveLoans', () {
    test('is false without loans', () {
      expect(makeClient().hasActiveLoans, isFalse);
    });

    test('is true when any loan is active', () {
      expect(
        makeClient(
          loans: [
            summary('L1', LoanStatus.cleared),
            summary('L2', LoanStatus.active),
          ],
        ).hasActiveLoans,
        isTrue,
      );
    });

    test('is false when loans are only overdue or cleared', () {
      expect(
        makeClient(
          loans: [
            summary('L1', LoanStatus.overdue),
            summary('L2', LoanStatus.cleared),
          ],
        ).hasActiveLoans,
        isFalse,
      );
    });
  });

  group('Client.hasOverdueLoans', () {
    test('is false without loans', () {
      expect(makeClient().hasOverdueLoans, isFalse);
    });

    test('is true when any loan is overdue', () {
      expect(
        makeClient(
          loans: [
            summary('L1', LoanStatus.active),
            summary('L2', LoanStatus.overdue),
          ],
        ).hasOverdueLoans,
        isTrue,
      );
    });

    test('is false when no loan is overdue', () {
      expect(
        makeClient(loans: [summary('L1', LoanStatus.active)]).hasOverdueLoans,
        isFalse,
      );
    });
  });

  group('RiskLevel re-export', () {
    test('client.dart re-exports the core RiskLevel enum', () {
      expect(RiskLevel.high.label, 'High risk');
    });
  });

  group('ClientInvite', () {
    test('defaults to not completed', () {
      final invite = ClientInvite(
        code: 'KMV-1000',
        businessName: 'Chilenje Community SACCO',
        clientName: 'Mwansa Bwalya',
        phone: '0971112233',
      );

      expect(invite.completed, isFalse);
    });

    test('mutable completed flag can be flipped', () {
      final invite = ClientInvite(
        code: 'KMV-1000',
        businessName: 'SACCO',
        clientName: 'A',
        phone: '0971111111',
      );

      invite.completed = true;
      expect(invite.completed, isTrue);
    });
  });

  group('InviteException', () {
    test('renders its message via toString', () {
      const e = InviteException('This invite is no longer valid.');
      expect(e.toString(), 'This invite is no longer valid.');
      expect(e.message, 'This invite is no longer valid.');
    });
  });
}
