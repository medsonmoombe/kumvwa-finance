/**
 * Payment scaffolding shared by every money path (repayments, disbursements,
 * client-slot purchases). The state machine is pure so the API can refuse an
 * illegal transition before it ever touches the DB, and tests can prove it.
 *
 * The provider drivers (sandbox today; MTN/Airtel/Zamtel/card later) all
 * report into this same vocabulary.
 */

export const PAYMENT_STATUSES = [
  'requires_action',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'refunded',
  'partially_refunded',
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PURPOSES = [
  'loan_repayment',
  'loan_disbursement',
  'client_slots',
  'invoice',
  'other',
] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_METHODS = ['mobile_money', 'card'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = [
  'mtn_momo',
  'airtel_money',
  'zamtel_kwacha',
  'card_psp',
  'sandbox',
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

/** Terminal states never transition again (except succeeded → refund). */
const TERMINAL: ReadonlySet<PaymentStatus> = new Set([
  'failed',
  'cancelled',
  'expired',
  'refunded',
]);

/**
 * Allowed transitions. A charge flows requires_action → processing →
 * succeeded | failed; a provider may also succeed straight from
 * requires_action (some telcos confirm synchronously).
 */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  requires_action: ['processing', 'succeeded', 'failed', 'cancelled', 'expired'],
  processing: ['succeeded', 'failed', 'expired'],
  succeeded: ['refunded', 'partially_refunded'],
  partially_refunded: ['refunded'],
  failed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) return true; // idempotent no-op
  return TRANSITIONS[from].includes(to);
}

/** Throws when a transition is illegal — call before persisting a status. */
export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal payment transition ${from} → ${to}`);
  }
}

export function isTerminal(status: PaymentStatus): boolean {
  return TERMINAL.has(status);
}

export function isSettled(status: PaymentStatus): boolean {
  return status === 'succeeded' || status === 'partially_refunded';
}

/** Providers that must be pushed to a phone number (they have no card rail). */
export function requiresPhone(provider: PaymentProvider): boolean {
  return provider === 'mtn_momo' || provider === 'airtel_money' || provider === 'zamtel_kwacha';
}

/**
 * The provider implied by a payer's phone prefix — mirrors the mobile app's
 * `_detectProvider` so client and server agree on which rail to use.
 * 097/077/057 → Airtel · 096/056/076 → MTN · 095 → Zamtel · else MTN.
 * Accepts +260…, 260…, or local 0… forms.
 */
export function providerFromPhone(
  phone: string,
  fallback: PaymentProvider = 'mtn_momo',
): PaymentProvider {
  const digits = phone.replace(/[^0-9]/g, '');
  let local = digits.startsWith('260') ? digits.slice(3) : digits;
  // Local Zambian numbers are dialled with a leading 0 (0977…); the country
  // code form drops it. Strip it so both spellings detect the same rail.
  if (local.startsWith('0')) local = local.slice(1);
  if (local.startsWith('97') || local.startsWith('77') || local.startsWith('57')) {
    return 'airtel_money';
  }
  if (local.startsWith('95')) return 'zamtel_kwacha';
  if (
    local.startsWith('96') ||
    local.startsWith('56') ||
    local.startsWith('76')
  ) {
    return 'mtn_momo';
  }
  return fallback;
}
