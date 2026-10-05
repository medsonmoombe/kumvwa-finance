import type {
  PaymentProvider,
  PaymentStatus,
} from '@kumvwa/core';

/** Input to a charge (collection from a payer). */
export interface ChargeInput {
  intentId: string;
  reference: string;
  amountMinor: bigint;
  currency: string;
  /** MoMo push target — the payer's registered number. */
  phone?: string | null;
  /** Free-form metadata (e.g. { simulate: 'fail' } in the sandbox). */
  metadata?: Record<string, unknown>;
}

/** Input to a payout (disbursement to a borrower). */
export interface PayoutInput {
  intentId: string;
  reference: string;
  amountMinor: bigint;
  currency: string;
  phone: string;
  metadata?: Record<string, unknown>;
}

/** Normalised result every driver reports back in. */
export interface ProviderResult {
  status: Extract<
    PaymentStatus,
    'requires_action' | 'processing' | 'succeeded' | 'failed'
  >;
  providerRef?: string;
  failureReason?: string;
  raw?: unknown;
}

/** Verified, normalised webhook. */
export interface WebhookVerdict {
  ok: boolean;
  eventId: string;
  /** The intent this event is about (its reference or providerRef). */
  reference?: string;
  providerRef?: string;
  status: Extract<PaymentStatus, 'succeeded' | 'failed' | 'refunded'>;
  raw: unknown;
}

/**
 * The single seam between the payments engine and any money rail. The sandbox
 * driver implements it today; MTN MoMo / Airtel Money / Zamtel Kwacha / a card
 * PSP plug in later WITHOUT touching business logic.
 */
export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  initiateCharge(input: ChargeInput): Promise<ProviderResult>;
  queryStatus(providerRef: string): Promise<ProviderResult>;
  initiatePayout(input: PayoutInput): Promise<ProviderResult>;
  refund(providerRef: string, amountMinor: bigint): Promise<ProviderResult>;
  verifyWebhook(
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookVerdict;
}
