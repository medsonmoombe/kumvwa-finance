import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { LedgerAccount, PaymentIntent, Prisma } from '@prisma/client';
import {
  kwachaToMinor,
  minorToKwacha,
  minorToKwachaString,
  providerFromPhone,
  requiresPhone,
  type PaymentProvider,
} from '@kumvwa/core';

import { ENV, type Env } from '../../config/env';
import type { TokenClaims } from '../../common/crypto/token.service';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { BillingService } from '../billing/billing.service';
import { LoansService } from '../loans/loans.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateIntentDto, DisburseDto } from './dto/payments.dto';
import { LedgerService, type LedgerEntry } from './ledger.service';
import type { ProviderResult, WebhookVerdict } from './providers/provider.interface';
import { PaymentProviderRegistry } from './providers/provider.registry';

/** Object-level scope of a caller: borrowers own payments, lenders book them. */
export type PaymentScope = { tenantId?: string; clientId?: string };

/**
 * How many times a charge may be re-asked of the provider before it is left
 * alone. A charge that never resolves is a reconciliation case for a human, not
 * something to poll every 30s forever — and it is never force-failed.
 */
export const MAX_RECONCILE_ATTEMPTS = 10;

/**
 * The unified money engine. Every movement on the platform — loan
 * repayments, loan disbursements, client-slot purchases — is a PaymentIntent
 * driven through a provider adapter, settled idempotently, and posted to the
 * ledger. The API is the single source of truth: amounts are validated here
 * (never trusted from the client), transitions are guarded by the shared
 * state machine, and effects are applied exactly once via a status claim.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly billing: BillingService,
    private readonly loans: LoansService,
    private readonly ledger: LedgerService,
    private readonly registry: PaymentProviderRegistry,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ─────────────── helpers ───────────────

  private scopeOf(u: TokenClaims): PaymentScope {
    return u.role === 'client'
      ? { clientId: u.clientId ?? undefined }
      : { tenantId: u.tenantId ?? undefined };
  }

  private inScope(i: PaymentIntent, s: PaymentScope): boolean {
    if (s.clientId !== undefined) return i.clientId === s.clientId;
    if (s.tenantId !== undefined) return i.tenantId === s.tenantId;
    return false;
  }

  private maskPhone(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : phone;
  }

  /** Human reference `PAY-YYYY-NNNNN`, collision-safe under retry. */
  private async nextReference(): Promise<string> {
    const year = new Date().getFullYear();
    for (let i = 0; i < 6; i++) {
      const count = await this.prisma.paymentIntent.count({
        where: { reference: { startsWith: `PAY-${year}-` } },
      });
      const candidate = `PAY-${year}-${String(count + 1 + i).padStart(5, '0')}`;
      const clash = await this.prisma.paymentIntent.findUnique({
        where: { reference: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    return `PAY-${year}-${Date.now().toString().slice(-6)}`;
  }

  /** Resolve the rail + method from the request and the payer's number. */
  private resolveRail(
    dto: { provider?: PaymentProvider; method?: string; phone?: string },
    fallbackPhone?: string | null,
  ): { provider: PaymentProvider; method: 'mobile_money' | 'card'; phone: string | null } {
    const phone = (dto.phone ?? fallbackPhone ?? '').trim() || null;
    const provider: PaymentProvider =
      dto.provider ?? (dto.method === 'card' ? 'card_psp' : providerFromPhone(phone ?? ''));
    if (requiresPhone(provider) && !phone) {
      throw new BadRequestException(
        'A mobile-money number is required for this payment method',
      );
    }
    const method = provider === 'card_psp' ? 'card' : 'mobile_money';
    return { provider, method, phone };
  }

  private toJson(i: PaymentIntent) {
    return {
      id: i.id,
      reference: i.reference,
      purpose: i.purpose,
      status: i.status,
      amountMinor: i.amountMinor.toString(),
      amount: minorToKwachaString(i.amountMinor),
      currency: i.currency,
      method: i.method,
      provider: i.provider,
      payerPhone: this.maskPhone(i.payerPhone),
      loanId: i.loanId,
      clientId: i.clientId,
      tenantId: i.tenantId,
      providerRef: i.providerRef,
      failureReason: i.failureReason,
      metadata: i.metadata,
      expiresAt: i.expiresAt,
      createdAt: i.createdAt,
      updatedAt: i.updatedAt,
    };
  }

  // ─────────────── reads ───────────────

  async getIntentFor(u: TokenClaims, id: string) {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });
    if (!intent || !this.inScope(intent, this.scopeOf(u))) {
      throw new NotFoundException('Payment not found');
    }
    if (intent.status === 'requires_action' || intent.status === 'processing') {
      const synced = await this.syncIntent(intent.id);
      if (synced) return this.toJson(synced);
    }
    return this.toJson(intent);
  }

  async list(
    u: TokenClaims,
    filters: { purpose?: string; status?: string; limit?: number },
  ) {
    const s = this.scopeOf(u);
    const take = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const rows = await this.prisma.paymentIntent.findMany({
      where: {
        ...(s.clientId ? { clientId: s.clientId } : {}),
        ...(s.tenantId ? { tenantId: s.tenantId } : {}),
        ...(filters.purpose ? { purpose: filters.purpose as never } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return { items: rows.map((r) => this.toJson(r)) };
  }

  async cancel(u: TokenClaims, id: string) {
    const intent = await this.prisma.paymentIntent.findUnique({ where: { id } });
    if (!intent || !this.inScope(intent, this.scopeOf(u))) {
      throw new NotFoundException('Payment not found');
    }
    if (intent.status !== 'requires_action' && intent.status !== 'processing') {
      throw new BadRequestException('This payment can no longer be cancelled');
    }
    const updated = await this.prisma.paymentIntent.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    await this.audit.record({
      actorId: u.sub,
      action: 'payment.cancel',
      entity: 'PaymentIntent',
      entityId: id,
      tenantId: intent.tenantId ?? undefined,
      diff: { reference: intent.reference },
    });
    return this.toJson(updated);
  }

  // ─────────────── create a charge ───────────────

  /**
   * Creates (or replays) a payment intent and starts the charge. The amount is
   * validated here — for `client_slots` it is COMPUTED from the plan, never
   * taken from the body, so a client cannot buy slots for less than K100 each.
   */
  async createIntent(
    u: TokenClaims,
    dto: CreateIntentDto,
    idempotencyKey?: string,
  ) {
    const key = idempotencyKey?.trim() || randomUUID();
    const replay = await this.prisma.paymentIntent.findUnique({
      where: { idempotencyKey: key },
    });
    if (replay) {
      if (!this.inScope(replay, this.scopeOf(u))) {
        throw new ConflictException('Idempotency key reused for another payment');
      }
      return this.toJson(replay);
    }

    let tenantId: string | null = null;
    let clientId: string | null = null;
    let loanId: string | null = null;
    let fallbackPhone: string | null = null;
    let metadata: Record<string, unknown> = { ...(dto.metadata ?? {}) };
    let amountMinor: bigint;

    if (dto.purpose === 'client_slots') {
      if (!u.tenantId) {
        throw new BadRequestException('Only a lender can buy client slots');
      }
      tenantId = u.tenantId;
      const count = dto.slotCount ?? 0;
      if (!Number.isInteger(count) || count <= 0) {
        throw new BadRequestException('slotCount must be a positive integer');
      }
      // Server-authoritative price — the body's amount is ignored for slots.
      const q = await this.billing.quote(u.tenantId, count);
      amountMinor = BigInt(q.totalMinor);
      metadata = { ...metadata, count };
      // "Their current number for payments": default the MoMo push to the
      // payer's registered phone rather than trusting one from the client.
      if (!dto.phone) {
        const payer = await this.prisma.user.findUnique({
          where: { id: u.sub },
          select: { phone: true },
        });
        fallbackPhone = payer?.phone ?? null;
      }
    } else if (dto.purpose === 'loan_repayment') {
      if (!dto.loanId) throw new BadRequestException('loanId is required');
      const loan = await this.prisma.loan.findUnique({
        where: { id: dto.loanId },
        include: { client: { select: { phone: true } } },
      });
      // Deny-list: a client may only pay their OWN loan; a lender its book only.
      if (
        !loan ||
        (u.role === 'client' && loan.clientId !== u.clientId) ||
        (u.role !== 'client' && loan.tenantId !== u.tenantId)
      ) {
        throw new NotFoundException('Loan not found');
      }
      loanId = loan.id;
      clientId = loan.clientId;
      tenantId = loan.tenantId;
      fallbackPhone = loan.client.phone;
      if (dto.amount === undefined) {
        throw new BadRequestException('amount is required');
      }
      amountMinor = kwachaToMinor(dto.amount);
      if (amountMinor <= 0n) {
        throw new BadRequestException('Amount must be greater than zero');
      }
    } else if (dto.purpose === 'loan_disbursement') {
      throw new BadRequestException(
        'Use POST payments disbursements for disbursements',
      );
    } else {
      throw new BadRequestException('Unsupported payment purpose');
    }

    const { provider, method, phone } = this.resolveRail(dto, fallbackPhone);

    const intent = await this.prisma.paymentIntent.create({
      data: {
        reference: await this.nextReference(),
        purpose: dto.purpose,
        tenantId,
        payerUserId: u.sub,
        clientId,
        loanId,
        amountMinor,
        currency: 'ZMW',
        method,
        provider,
        payerPhone: phone,
        status: 'requires_action',
        idempotencyKey: key,
        metadata: metadata as Prisma.InputJsonObject,
        expiresAt: new Date(
          Date.now() + this.env.PAYMENTS_INTENT_TTL_MIN * 60_000,
        ),
      },
    });

    const adapter = this.registry.get(provider);
    try {
      const result = await adapter.initiateCharge({
        intentId: intent.id,
        reference: intent.reference,
        amountMinor,
        currency: 'ZMW',
        phone,
        metadata,
      });
      await this.applyProviderResult(intent.id, result, u.sub);
    } catch (e) {
      const fresh = await this.prisma.paymentIntent.findUniqueOrThrow({
        where: { id: intent.id },
      });
      await this.fail(
        fresh,
        e instanceof Error ? e.message : 'Could not start the payment',
        u.sub,
      );
    }

    return this.getIntentFor(u, intent.id);
  }

  // ─────────────── disbursement ───────────────

  /** Lender disburses an approved loan to the borrower's number. */
  async disburse(u: TokenClaims, dto: DisburseDto, idempotencyKey?: string) {
    if (!u.tenantId) throw new BadRequestException('Lender account required');
    const loan = await this.prisma.loan.findUnique({
      where: { id: dto.loanId },
      include: { client: { select: { id: true, phone: true } } },
    });
    if (!loan || loan.tenantId !== u.tenantId) {
      throw new NotFoundException('Loan not found');
    }
    if (loan.disbursedAt) {
      throw new BadRequestException('This loan has already been disbursed');
    }

    const amountMinor =
      loan.disbursementMinor > 0n ? loan.disbursementMinor : loan.principal;
    const resolved = this.resolveRail(dto, dto.phone ?? loan.client.phone);
    // Disbursements are payouts over the telco rails (card payout later).
    const provider: PaymentProvider =
      resolved.provider === 'card_psp' ? 'mtn_momo' : resolved.provider;
    const phone = resolved.phone;

    const key = idempotencyKey?.trim() || randomUUID();
    const replay = await this.prisma.paymentIntent.findUnique({
      where: { idempotencyKey: key },
    });
    if (replay) return this.toJson(replay);

    const intent = await this.prisma.paymentIntent.create({
      data: {
        reference: await this.nextReference(),
        purpose: 'loan_disbursement',
        tenantId: u.tenantId,
        payerUserId: u.sub,
        clientId: loan.clientId,
        loanId: loan.id,
        amountMinor,
        currency: 'ZMW',
        method: 'mobile_money',
        provider,
        payerPhone: phone,
        status: 'requires_action',
        idempotencyKey: key,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonObject,
        expiresAt: new Date(
          Date.now() + this.env.PAYMENTS_INTENT_TTL_MIN * 60_000,
        ),
      },
    });

    await this.prisma.payout.create({
      data: {
        intentId: intent.id,
        tenantId: u.tenantId,
        clientId: loan.clientId,
        loanId: loan.id,
        amountMinor,
        provider,
        phone: phone ?? '',
        status: 'requires_action',
      },
    });

    try {
      const result = await this.registry.get(provider).initiatePayout({
        intentId: intent.id,
        reference: intent.reference,
        amountMinor,
        currency: 'ZMW',
        phone: phone ?? '',
        metadata: dto.metadata,
      });
      await this.prisma.payout.updateMany({
        where: { intentId: intent.id },
        data: {
          providerRef: result.providerRef ?? undefined,
          status: result.status === 'succeeded' ? 'succeeded' : 'processing',
        },
      });
      await this.applyProviderResult(intent.id, result, u.sub);
    } catch (e) {
      const fresh = await this.prisma.paymentIntent.findUniqueOrThrow({
        where: { id: intent.id },
      });
      await this.fail(
        fresh,
        e instanceof Error ? e.message : 'Disbursement failed',
        u.sub,
      );
    }

    return this.getIntentFor(u, intent.id);
  }

  // ─────────────── provider result handling ───────────────

  private async applyProviderResult(
    intentId: string,
    result: ProviderResult,
    actorId: string,
  ): Promise<void> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) return;
    if (
      intent.status === 'succeeded' ||
      intent.status === 'failed' ||
      intent.status === 'cancelled' ||
      intent.status === 'expired' ||
      intent.status === 'refunded'
    ) {
      return;
    }
    if (result.status === 'succeeded') {
      await this.settle(intent, result, actorId);
      return;
    }
    if (result.status === 'failed') {
      await this.fail(
        intent,
        result.failureReason ?? 'Payment failed',
        actorId,
        result.providerRef,
      );
      return;
    }
    await this.prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: ['requires_action', 'processing'] } },
      data: {
        status: result.status,
        ...(result.providerRef ? { providerRef: result.providerRef } : {}),
      },
    });
  }

  private async fail(
    intent: PaymentIntent,
    reason: string,
    actorId: string,
    providerRef?: string,
  ): Promise<void> {
    const claimed = await this.prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: ['requires_action', 'processing'] } },
      data: {
        status: 'failed',
        failureReason: reason.slice(0, 500),
        ...(providerRef ? { providerRef } : {}),
      },
    });
    if (claimed.count === 0) return;
    await this.audit.record({
      actorId,
      action: 'payment.failed',
      entity: 'PaymentIntent',
      entityId: intent.id,
      tenantId: intent.tenantId ?? undefined,
      diff: { reference: intent.reference, reason },
    });
  }

  /** Poll the provider and advance an in-flight intent. Safe to call anytime. */
  async syncIntent(intentId: string): Promise<PaymentIntent | null> {
    const intent = await this.prisma.paymentIntent.findUnique({
      where: { id: intentId },
    });
    if (!intent) return null;
    if (intent.status !== 'requires_action' && intent.status !== 'processing') {
      return intent;
    }
    if (!intent.providerRef) return intent;
    try {
      const result = await this.registry
        .get(intent.provider)
        .queryStatus(intent.providerRef);
      await this.applyProviderResult(
        intent.id,
        result,
        intent.payerUserId ?? 'system',
      );
    } catch {
      // Provider unreachable — leave it in flight; the reconciler retries.
    }
    return this.prisma.paymentIntent.findUnique({ where: { id: intentId } });
  }

  // ─────────────── settlement ───────────────

  /**
   * Settles a succeeded intent EXACTLY ONCE. The domain effect runs first
   * (each is itself idempotent), then a conditional status flip claims the
   * transition for the winner — only the winner writes the ledger and fires
   * notifications. A lost race is a silent no-op.
   */
  private async settle(
    intent: PaymentIntent,
    result: ProviderResult,
    actorId: string,
  ): Promise<void> {
    await this.applyEffect(intent, actorId);

    const claimed = await this.prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: { in: ['requires_action', 'processing'] } },
      data: {
        status: 'succeeded',
        failureReason: null,
        ...(result.providerRef ? { providerRef: result.providerRef } : {}),
      },
    });
    if (claimed.count === 0) return;

    await this.ledger.post(intent.id, this.ledgerEntriesFor(intent, result));
    await this.afterSettled(intent, actorId);
  }

  /** The domain effect for a settled intent. Idempotent by construction. */
  private async applyEffect(
    intent: PaymentIntent,
    actorId: string,
  ): Promise<void> {
    switch (intent.purpose) {
      case 'loan_repayment': {
        if (!intent.loanId) return;
        const loan = await this.prisma.loan.findUnique({
          where: { id: intent.loanId },
        });
        if (!loan) return;
        // Route through the one repayment path so allocation stays in one place.
        await this.loans.recordRepayment(
          { tenantId: loan.tenantId, clientId: loan.clientId },
          intent.payerUserId ?? actorId,
          loan.id,
          {
            amount: minorToKwacha(intent.amountMinor),
            method: intent.method === 'card' ? 'in_app' : 'mobile_money',
            reference: intent.reference,
          },
          `intent:${intent.id}`,
          { paymentIntentId: intent.id },
        );
        return;
      }
      case 'client_slots': {
        if (!intent.tenantId) return;
        const count = Number(
          (intent.metadata as Record<string, unknown> | null)?.['count'] ?? 0,
        );
        if (!Number.isInteger(count) || count <= 0) return;
        await this.billing.activateSlots({
          tenantId: intent.tenantId,
          count,
          unitPriceMinor: intent.amountMinor / BigInt(count),
          amountMinor: intent.amountMinor,
          paymentIntentId: intent.id,
          actorId: intent.payerUserId ?? actorId,
        });
        return;
      }
      case 'loan_disbursement': {
        if (!intent.loanId) return;
        await this.prisma.loan.updateMany({
          where: { id: intent.loanId, disbursedAt: null },
          data: { disbursedAt: new Date() },
        });
        await this.prisma.payout.updateMany({
          where: { intentId: intent.id },
          data: { status: 'succeeded' },
        });
        return;
      }
      default:
        return;
    }
  }

  /** Balanced double-entry lines for a settled intent. */
  private ledgerEntriesFor(
    intent: PaymentIntent,
    result: ProviderResult,
  ): LedgerEntry[] {
    const amt = intent.amountMinor;
    const ref = result.providerRef ?? intent.providerRef;
    const raw = result.raw;

    if (intent.purpose === 'loan_disbursement') {
      return [
        { entryType: 'disbursement', account: 'tenant_payable', direction: 'debit', amountMinor: amt, providerRef: ref, rawPayload: raw },
        { entryType: 'disbursement', account: 'external_provider', direction: 'credit', amountMinor: amt, providerRef: ref, rawPayload: raw },
      ];
    }

    const credit: LedgerAccount =
      intent.purpose === 'client_slots'
        ? 'platform_slot_revenue'
        : intent.purpose === 'loan_repayment'
          ? 'loan_receivable'
          : 'tenant_payable';

    return [
      { entryType: 'charge', account: 'external_provider', direction: 'debit', amountMinor: amt, providerRef: ref, rawPayload: raw },
      { entryType: 'charge', account: credit, direction: 'credit', amountMinor: amt, providerRef: ref, rawPayload: raw },
    ];
  }

  /** Post-settlement fan-out: notify the borrower, write the audit entry. */
  private async afterSettled(
    intent: PaymentIntent,
    actorId: string,
  ): Promise<void> {
    if (intent.clientId && intent.purpose === 'loan_repayment') {
      const clientUser = await this.prisma.user.findFirst({
        where: { clientId: intent.clientId, role: 'client' },
        select: { id: true },
      });
      if (clientUser) {
        await this.notify.create(
          clientUser.id,
          'payment_received',
          'Payment received',
          `We received your K${minorToKwachaString(intent.amountMinor)} payment (${intent.reference}).`,
          { paymentIntentId: intent.id, loanId: intent.loanId },
        );
      }
    }

    await this.audit.record({
      actorId,
      action: 'payment.succeeded',
      description: `${intent.purpose} ${intent.reference} settled via ${intent.provider}`,
      entity: 'PaymentIntent',
      entityId: intent.id,
      tenantId: intent.tenantId ?? undefined,
      diff: {
        amountMinor: intent.amountMinor.toString(),
        purpose: intent.purpose,
        provider: intent.provider,
      },
    });
  }

  // ─────────────── webhooks + reconciliation ───────────────

  private async resolveWebhookIntent(verdict: WebhookVerdict) {
    if (verdict.reference) {
      const byRef = await this.prisma.paymentIntent.findUnique({
        where: { reference: verdict.reference },
      });
      if (byRef) return byRef;
    }
    if (verdict.providerRef) {
      return this.prisma.paymentIntent.findFirst({
        where: { providerRef: verdict.providerRef },
      });
    }
    return null;
  }

  /**
   * Ingests a provider webhook: verifies the signature, dedupes on the
   * provider event id, then settles/fails the referenced intent. Safe to
   * replay — a duplicate event is acknowledged without re-processing.
   */
  async handleWebhook(
    provider: PaymentProvider,
    raw: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ) {
    const verdict = this.registry.get(provider).verifyWebhook(raw, headers);

    const existing = await this.prisma.paymentWebhookEvent.findUnique({
      where: { provider_eventId: { provider, eventId: verdict.eventId } },
    });
    if (existing) return { received: true, duplicate: true };

    const event = await this.prisma.paymentWebhookEvent.create({
      data: {
        provider,
        eventId: verdict.eventId,
        signatureOk: verdict.ok,
        payload: verdict.raw ?? {},
        status: verdict.ok ? 'received' : 'ignored',
      },
    });

    if (!verdict.ok) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'ignored', error: 'invalid signature', processedAt: new Date() },
      });
      return { received: true, verified: false };
    }

    const intent = await this.resolveWebhookIntent(verdict);
    if (!intent) {
      await this.prisma.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'failed', error: 'intent not found', processedAt: new Date() },
      });
      return { received: true, verified: true };
    }

    if (verdict.status === 'refunded') {
      await this.prisma.paymentIntent.updateMany({
        where: { id: intent.id, status: 'succeeded' },
        data: { status: 'refunded' },
      });
    } else {
      await this.applyProviderResult(
        intent.id,
        {
          status: verdict.status,
          providerRef: verdict.providerRef ?? intent.providerRef ?? undefined,
          raw: verdict.raw,
        },
        'webhook',
      );
    }

    await this.prisma.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: 'processed', processedAt: new Date() },
    });
    return { received: true, verified: true, intentId: intent.id };
  }

  /**
   * Sweep in-flight intents and advance them via the provider. Called by the
   * worker's reconciler job and safe to run on a schedule.
   */
  async reconcileInFlight(
    limit = 50,
  ): Promise<{ checked: number; settled: number; abandoned: number }> {
    const rows = await this.prisma.paymentIntent.findMany({
      where: {
        status: { in: ['requires_action', 'processing'] },
        providerRef: { not: null },
        // Bounds retries: a charge the provider cannot answer about is left for
        // a human rather than polled on every tick forever.
        reconcileAttempts: { lt: MAX_RECONCILE_ATTEMPTS },
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 200),
    });
    let settled = 0;
    let abandoned = 0;
    for (const row of rows) {
      const before = row.status;
      // Count the attempt first, so a provider that keeps erroring is retried a
      // bounded number of times and then left for manual review.
      await this.prisma.paymentIntent.update({
        where: { id: row.id },
        data: { reconcileAttempts: { increment: 1 } },
      });
      const after = await this.syncIntent(row.id);
      if (
        after &&
        after.status !== before &&
        (after.status === 'succeeded' || after.status === 'failed')
      ) {
        settled += 1;
      }
    }
    // Anything that ran out of attempts stays as-is: a real charge is never
    // force-failed, only reported.
    abandoned = await this.prisma.paymentIntent.count({
      where: {
        status: 'processing',
        reconcileAttempts: { gte: MAX_RECONCILE_ATTEMPTS },
      },
    });
    return { checked: rows.length, settled, abandoned };
  }

  /**
   * Move stale, never-approved intents to `expired`. Housekeeping for the sweep
   * in `main.ts`.
   *
   * Only `requires_action` is expired. A `processing` charge is NOT expired
   * here even when its TTL has passed: the money may genuinely be in flight, so
   * it is left for `reconcileInFlight` to ask the provider. Expiring it would
   * either lose a real payment or mark a live one as lapsed.
   */
  async expireStaleIntents(): Promise<number> {
    const res = await this.prisma.paymentIntent.updateMany({
      where: {
        status: 'requires_action',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired', failureReason: 'Expired before confirmation' },
    });
    return res.count;
  }

  /**
   * Platform-admin ledger view across every tenant — the console's
   * Transactions tab. No scope filter: platform_admin sees all.
   */
  async listAll(filters: {
    purpose?: string;
    status?: string;
    tenantId?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    const rows = await this.prisma.paymentIntent.findMany({
      where: {
        ...(filters.purpose ? { purpose: filters.purpose as never } : {}),
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return { items: rows.map((r) => this.toJson(r)) };
  }
}
