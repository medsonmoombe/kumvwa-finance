import 'package:flutter_test/flutter_test.dart';

import 'package:kumvwa_finance/features/clients/data/invite_repository.dart';
import 'package:kumvwa_finance/features/clients/domain/client_invite.dart';

void main() {
  late MockInviteRepository repo;

  setUp(() => repo = MockInviteRepository());

  test(
    'createInvite returns a short code and echoes the client details',
    () async {
      final invite = await repo.createInvite(
        clientName: '  Mwansa Bwalya  ',
        phone: ' 0971234567 ',
      );

      expect(invite.code, 'KMV-1000');
      expect(invite.clientName, 'Mwansa Bwalya'); // trimmed
      expect(invite.phone, '0971234567');
      expect(invite.completed, isFalse);
    },
  );

  test('codes increment across invites', () async {
    final first = await repo.createInvite(clientName: 'A', phone: '0971111111');
    final second = await repo.createInvite(
      clientName: 'B',
      phone: '0972222222',
    );

    expect(first.code, 'KMV-1000');
    expect(second.code, 'KMV-1001');
  });

  test('getByCode is case- and whitespace-insensitive', () async {
    await repo.createInvite(clientName: 'A', phone: '0971111111');

    final invite = await repo.getByCode('  kmv-1000 ');

    expect(invite.clientName, 'A');
  });

  test('getByCode throws InviteException for an unknown code', () async {
    expect(
      () => repo.getByCode('KMV-9999'),
      throwsA(
        isA<InviteException>().having(
          (e) => e.message,
          'message',
          contains('invalid or has expired'),
        ),
      ),
    );
  });

  test('submitAccount marks the invite completed', () async {
    final invite = await repo.createInvite(
      clientName: 'A',
      phone: '0971111111',
    );

    await repo.submitAccount(
      code: invite.code,
      fullName: 'A Mwape',
      password: 'kumvwa123',
      consent: true,
    );

    final reloaded = await repo.getByCode(invite.code);
    expect(reloaded.completed, isTrue);
  });

  test('submitAccount throws InviteException for an unknown code', () async {
    expect(
      () => repo.submitAccount(
        code: 'KMV-9999',
        fullName: 'A Mwape',
        password: 'kumvwa123',
        consent: true,
      ),
      throwsA(isA<InviteException>()),
    );
  });
}
