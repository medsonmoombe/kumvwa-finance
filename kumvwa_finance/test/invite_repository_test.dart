import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

void main() {
  late MockInviteRepository repo;

  setUp(() => repo = MockInviteRepository());

  test('createInvite returns a token and echoes the client details', () async {
    final invite = await repo.createInvite(
      clientName: '  Mwansa Bwalya  ',
      phone: ' 0971234567 ',
    );

    expect(invite.token, 'INV1000');
    expect(invite.clientName, 'Mwansa Bwalya'); // trimmed
    expect(invite.phone, '0971234567');
    expect(invite.completed, isFalse);
  });

  test('tokens increment across invites', () async {
    final first = await repo.createInvite(clientName: 'A', phone: '0971111111');
    final second = await repo.createInvite(
      clientName: 'B',
      phone: '0972222222',
    );

    expect(first.token, 'INV1000');
    expect(second.token, 'INV1001');
  });

  test('getByToken is case- and whitespace-insensitive', () async {
    await repo.createInvite(clientName: 'A', phone: '0971111111');

    final invite = await repo.getByToken('  inv1000 ');

    expect(invite.clientName, 'A');
  });

  test('getByToken throws InviteException for an unknown token', () async {
    expect(
      () => repo.getByToken('INV9999'),
      throwsA(
        isA<InviteException>().having(
          (e) => e.message,
          'message',
          contains('invalid or has expired'),
        ),
      ),
    );
  });

  test('submitProfile marks the invite completed', () async {
    final invite = await repo.createInvite(
      clientName: 'A',
      phone: '0971111111',
    );

    await repo.submitProfile(
      token: invite.token,
      nrc: '245711/63/1',
      dateOfBirth: DateTime(1998, 4, 12),
      address: 'Plot 12, Chilenje',
    );

    final reloaded = await repo.getByToken(invite.token);
    expect(reloaded.completed, isTrue);
  });

  test('submitProfile throws InviteException for an unknown token', () async {
    expect(
      () => repo.submitProfile(
        token: 'INV9999',
        nrc: '245711/63/1',
        dateOfBirth: DateTime(1998, 4, 12),
        address: 'Plot 12, Chilenje',
      ),
      throwsA(isA<InviteException>()),
    );
  });
}
