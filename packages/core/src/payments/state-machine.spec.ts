import {
  assertTransition,
  canTransition,
  isSettled,
  isTerminal,
  providerFromPhone,
  requiresPhone,
  type PaymentStatus,
} from './state-machine';

describe('payment state machine', () => {
  it('happy path: requires_action → processing → succeeded', () => {
    expect(canTransition('requires_action', 'processing')).toBe(true);
    expect(canTransition('processing', 'succeeded')).toBe(true);
    expect(canTransition('succeeded', 'failed')).toBe(false);
    expect(() => assertTransition('succeeded', 'processing')).toThrow();
  });

  it('synchronous telco success from requires_action is allowed', () => {
    expect(canTransition('requires_action', 'succeeded')).toBe(true);
  });

  it('terminal states never move (except a refund)', () => {
    for (const s of ['failed', 'cancelled', 'expired'] as PaymentStatus[]) {
      expect(isTerminal(s)).toBe(true);
      expect(canTransition(s, 'succeeded')).toBe(false);
      expect(canTransition(s, 'processing')).toBe(false);
    }
    expect(canTransition('succeeded', 'refunded')).toBe(true);
    expect(canTransition('partially_refunded', 'refunded')).toBe(true);
  });

  it('settled = succeeded or partially_refunded', () => {
    expect(isSettled('succeeded')).toBe(true);
    expect(isSettled('partially_refunded')).toBe(true);
    expect(isSettled('processing')).toBe(false);
  });

  it('providerFromPhone mirrors the app: 097/077/057 → airtel, 095 → zamtel, else mtn', () => {
    expect(providerFromPhone('+260971234567')).toBe('airtel_money');
    expect(providerFromPhone('0977123456')).toBe('airtel_money');
    expect(providerFromPhone('+260957654321')).toBe('zamtel_kwacha');
    expect(providerFromPhone('+260961112222')).toBe('mtn_momo');
    expect(providerFromPhone('+26056')).toBe('mtn_momo');
  });

  it('only the telcos require a phone number', () => {
    expect(requiresPhone('mtn_momo')).toBe(true);
    expect(requiresPhone('airtel_money')).toBe(true);
    expect(requiresPhone('zamtel_kwacha')).toBe(true);
    expect(requiresPhone('card_psp')).toBe(false);
    expect(requiresPhone('sandbox')).toBe(false);
  });
});
