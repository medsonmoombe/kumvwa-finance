import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { BillingPlan, TenantSubscription } from '@prisma/client';
import {
  DEFAULT_BILLING_PLAN,
  capacityStatus,
  minorToKwachaString,
  priceForSlots,
  slotExpiry,
  validateBillingPlan,
  type BillingPlanShape,
  type CapacityStatus,
  type SubscriptionShape,
} from '@kumvwa/core';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import type {
  CreatePlanDto,
  SetSubscriptionDto,
  UpdatePlanDto,
} from './dto/billing.dto';

/** Shape used when a tenant has no subscription row yet — the free plan. */
const DEFAULT_SUB_SHAPE: SubscriptionShape = {
  status: 'active',
  includedClientsOverride: null,
  priceOverrideMinor: null,
  extraSlots: 0,
  slotsExpireAt: null,
};

function toPlanShape(p: BillingPlan): BillingPlanShape {
  return {
    key: p.key,
    name: p.name,
    includedClients: p.includedClients,
    pricePerExtraClientMinor: p.pricePerExtraClientMinor,
    interval: p.interval,
    active: p.active,
  };
}

function toSubShape(s: TenantSubscription | null): SubscriptionShape {
  if (!s) return DEFAULT_SUB_SHAPE;
  return {
    status: s.status,
    includedClientsOverride: s.includedClientsOverride,
    priceOverrideMinor: s.priceOverrideMinor,
    extraSlots: s.extraSlots,
    slotsExpireAt: s.slotsExpireAt,
  };
}

/**
 * A plan as JSON. `pricePerExtraClientMinor` is BigInt in the DB and JSON has
 * no BigInt — every response body must go through this or express 500s.
 */
function planJson(p: BillingPlan) {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    includedClients: p.includedClients,
    pricePerExtraClientMinor: p.pricePerExtraClientMinor.toString(),
    pricePerExtraClient: minorToKwachaString(p.pricePerExtraClientMinor),
    interval: p.interval,
    active: p.active,
    isDefault: p.isDefault,
  };
}

/**
 * Client-slot billing (the "3 free clients, K100 each extra, monthly" rule)
 * plus the entitlement guard the rest of the API calls before it lets a
 * lender add a client.
 *
 * The capacity MATH lives in @kumvwa/core/billing/capacity so the API guard,
 * the console usage bar and the mobile gate all read identical numbers. This
 * service is the storage + enforcement surface only.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────── plan + subscription reads ───────────────

  /** The platform default plan; seeds a free plan on first read if absent. */
  async defaultPlan(): Promise<BillingPlan> {
    const found = await this.prisma.billingPlan.findFirst({
      where: { isDefault: true, active: true },
    });
    if (found) return found;
    const anyActive = await this.prisma.billingPlan.findFirst({
      where: { active: true },
      orderBy: { includedClients: 'desc' },
    });
    if (anyActive) return anyActive;
    return this.prisma.billingPlan.create({
      data: {
        key: DEFAULT_BILLING_PLAN.key,
        name: DEFAULT_BILLING_PLAN.name,
        includedClients: DEFAULT_BILLING_PLAN.includedClients,
        pricePerExtraClientMinor: DEFAULT_BILLING_PLAN.pricePerExtraClientMinor,
        interval: DEFAULT_BILLING_PLAN.interval,
        isDefault: true,
        active: true,
      },
    });
  }

  private async planForSubscription(
    sub: TenantSubscription | null,
  ): Promise<BillingPlan> {
    if (sub) {
      const plan = await this.prisma.billingPlan.findUnique({
        where: { id: sub.planId },
      });
      if (plan) return plan;
    }
    return this.defaultPlan();
  }

  /** Everything the guard/console/app needs, in one read. */
  async statusFor(tenantId: string): Promise<{
    plan: ReturnType<typeof toPlanShape> & { id: string };
    subscription: SubscriptionShape & { id: string | null; planId: string | null; promoNote: string | null };
    capacity: CapacityStatus;
  }> {
    const [sub, used] = await Promise.all([
      this.prisma.tenantSubscription.findUnique({ where: { tenantId } }),
      this.prisma.clientLenderLink.count({ where: { tenantId } }),
    ]);
    const plan = await this.planForSubscription(sub);
    const planShape = toPlanShape(plan);
    const subShape = toSubShape(sub);
    return {
      plan: { ...planShape, id: plan.id },
      subscription: {
        ...subShape,
        id: sub?.id ?? null,
        planId: sub?.planId ?? null,
        promoNote: sub?.promoNote ?? null,
      },
      capacity: capacityStatus(planShape, subShape, used),
    };
  }

  /** Public read for the console/app billing screen. */
  async me(tenantId: string) {
    const s = await this.statusFor(tenantId);
    return {
      plan: {
        key: s.plan.key,
        name: s.plan.name,
        includedClients: s.plan.includedClients,
        pricePerExtraClientMinor: s.plan.pricePerExtraClientMinor.toString(),
        pricePerExtraClient: minorToKwachaString(s.plan.pricePerExtraClientMinor),
        interval: s.plan.interval,
      },
      status: s.subscription.status,
      includedClientsOverride: s.subscription.includedClientsOverride,
      priceOverrideMinor: s.subscription.priceOverrideMinor?.toString() ?? null,
      slotsExpireAt: s.subscription.slotsExpireAt,
      promoNote: s.subscription.promoNote,
      capacity: {
        capacity: s.capacity.capacity,
        used: s.capacity.used,
        remaining: s.capacity.remaining,
        canAddClient: s.capacity.canAdd,
        atLimit: s.capacity.atLimit,
        blocked: s.capacity.blocked,
        unitPriceMinor: s.capacity.unitPriceMinor,
        unitPrice: minorToKwachaString(BigInt(s.capacity.unitPriceMinor)),
      },
    };
  }

  // ─────────────── entitlement guard ───────────────

  /**
   * Throws when a lender may not add another client. 402 with `code` =
   * CLIENT_LIMIT at capacity (buy slots to continue), 403 with `code` =
   * BILLING_SUSPENDED when the subscription is hard-blocked. Called from
   * InvitesService at invite-create AND invite-complete.
   */
  async assertCanAddClient(tenantId: string): Promise<CapacityStatus> {
    const { capacity } = await this.statusFor(tenantId);
    if (capacity.blocked) {
      throw new ForbiddenException({
        code: 'BILLING_SUSPENDED',
        message:
          'Your account is suspended. Contact Kumvwa support to restore lending.',
      });
    }
    if (!capacity.canAdd) {
      throw new HttpException(
        {
          code: 'CLIENT_LIMIT',
          message:
            `You have reached your client limit (${capacity.used}/${capacity.capacity}). ` +
            `Buy an extra client slot for K${minorToKwachaString(BigInt(capacity.unitPriceMinor))}/month to add more.`,
          capacity: capacity.capacity,
          used: capacity.used,
          remaining: capacity.remaining,
          unitPriceMinor: capacity.unitPriceMinor,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return capacity;
  }

  /** Price preview for buying `count` slots (no payment yet). */
  async quote(tenantId: string, count: number) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new BadRequestException('count must be a positive integer');
    }
    const sub = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });
    const plan = await this.planForSubscription(sub);
    const unitPrice = sub?.priceOverrideMinor ?? plan.pricePerExtraClientMinor;
    const total = priceForSlots(toPlanShape(plan), toSubShape(sub), count);
    return {
      count,
      unitPriceMinor: unitPrice.toString(),
      unitPrice: minorToKwachaString(unitPrice),
      totalMinor: total.toString(),
      total: minorToKwachaString(total),
      interval: plan.interval,
    };
  }

  /**
   * Grants `count` paid slots after a client_slots intent settles. Idempotent
   * on the payment intent (the purchase row is unique on paymentIntentId). A
   * fresh purchase tops up the bucket and resets the one-month window.
   */
  async activateSlots(input: {
    tenantId: string;
    count: number;
    unitPriceMinor: bigint;
    amountMinor: bigint;
    paymentIntentId: string;
    actorId?: string | null;
  }) {
    if (!Number.isInteger(input.count) || input.count <= 0) {
      throw new BadRequestException('count must be a positive integer');
    }
    const plan = await this.defaultPlan();
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.clientSlotPurchase.findUnique({
        where: { paymentIntentId: input.paymentIntentId },
      });
      if (existing) return existing;

      const now = new Date();
      const sub = await tx.tenantSubscription.findUnique({
        where: { tenantId: input.tenantId },
      });
      const newExpiry = slotExpiry(now);
      const stillLive = sub?.slotsExpireAt
        ? sub.slotsExpireAt.getTime() > now.getTime()
        : false;
      const nextSlots = (stillLive ? (sub?.extraSlots ?? 0) : 0) + input.count;

      const purchase = await tx.clientSlotPurchase.create({
        data: {
          tenantId: input.tenantId,
          purchasedCount: input.count,
          unitPriceMinor: input.unitPriceMinor,
          amountMinor: input.amountMinor,
          periodStart: now,
          periodEnd: newExpiry,
          paymentIntentId: input.paymentIntentId,
          status: 'active',
          createdBy: input.actorId ?? null,
        },
      });

      await tx.tenantSubscription.upsert({
        where: { tenantId: input.tenantId },
        create: {
          tenantId: input.tenantId,
          planId: sub?.planId ?? plan.id,
          status: 'active',
          extraSlots: nextSlots,
          slotsExpireAt: newExpiry,
          currentPeriodStart: now,
          currentPeriodEnd: newExpiry,
          updatedBy: input.actorId ?? null,
        },
        update: {
          extraSlots: nextSlots,
          slotsExpireAt: newExpiry,
          updatedBy: input.actorId ?? null,
        },
      });

      await tx.billingEvent.create({
        data: {
          tenantId: input.tenantId,
          type: 'slots_purchased',
          toValue: {
            count: input.count,
            amountMinor: input.amountMinor.toString(),
            expiresAt: newExpiry.toISOString(),
          },
          actorId: input.actorId ?? null,
        },
      });

      return purchase;
    });
  }

  /** Lender-facing slot purchase history. */
  async purchasesFor(tenantId: string) {
    const rows = await this.prisma.clientSlotPurchase.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      items: rows.map((p) => ({
        id: p.id,
        count: p.purchasedCount,
        amountMinor: p.amountMinor.toString(),
        amount: minorToKwachaString(p.amountMinor),
        status: p.status,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paymentIntentId: p.paymentIntentId,
        createdAt: p.createdAt,
      })),
    };
  }

  // ─────────────── platform admin: plans ───────────────

  async listPlans() {
    const plans = await this.prisma.billingPlan.findMany({
      orderBy: { includedClients: 'asc' },
    });
    return { items: plans.map(planJson) };
  }

  async createPlan(actorId: string, dto: CreatePlanDto) {
    const shape: BillingPlanShape = {
      key: dto.key.trim().toLowerCase(),
      name: dto.name.trim(),
      includedClients: dto.includedClients,
      pricePerExtraClientMinor: BigInt(dto.pricePerExtraClientMinor),
      interval: 'monthly',
      active: dto.active ?? true,
    };
    validateBillingPlan(shape);
    const existing = await this.prisma.billingPlan.findUnique({
      where: { key: shape.key },
    });
    if (existing) throw new BadRequestException(`Plan '${shape.key}' already exists`);
    if (dto.isDefault) {
      await this.prisma.billingPlan.updateMany({ data: { isDefault: false } });
    }
    const plan = await this.prisma.billingPlan.create({
      data: { ...shape, isDefault: dto.isDefault ?? false },
    });
    await this.audit.record({
      actorId,
      action: 'billing.plan_create',
      entity: 'BillingPlan',
      entityId: plan.id,
      diff: { key: plan.key },
    });
    return planJson(plan);
  }

  async updatePlan(actorId: string, id: string, dto: UpdatePlanDto) {
    const existing = await this.prisma.billingPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Plan not found');
    const shape: BillingPlanShape = {
      key: existing.key,
      name: dto.name?.trim() ?? existing.name,
      includedClients: dto.includedClients ?? existing.includedClients,
      pricePerExtraClientMinor:
        dto.pricePerExtraClientMinor !== undefined
          ? BigInt(dto.pricePerExtraClientMinor)
          : existing.pricePerExtraClientMinor,
      interval: existing.interval,
      active: dto.active ?? existing.active,
    };
    validateBillingPlan(shape);
    if (dto.isDefault) {
      await this.prisma.billingPlan.updateMany({ data: { isDefault: false } });
    }
    const plan = await this.prisma.billingPlan.update({
      where: { id },
      data: {
        name: shape.name,
        includedClients: shape.includedClients,
        pricePerExtraClientMinor: shape.pricePerExtraClientMinor,
        active: shape.active,
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
    await this.audit.record({
      actorId,
      action: 'billing.plan_update',
      entity: 'BillingPlan',
      entityId: id,
      diff: { ...shape, pricePerExtraClientMinor: shape.pricePerExtraClientMinor.toString() },
    });
    return planJson(plan);
  }

  // ─────────────── platform admin: subscriptions ───────────────

  /** Every lender with their plan, overrides and live client usage. */
  async listSubscriptions(q?: string) {
    const tenants = await this.prisma.tenant.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' as const } } : {},
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const ids = tenants.map((t) => t.id);
    const [subs, counts, defaultPlan] = await Promise.all([
      ids.length
        ? this.prisma.tenantSubscription.findMany({
            where: { tenantId: { in: ids } },
            include: { plan: true },
          })
        : Promise.resolve([]),
      ids.length
        ? this.prisma.clientLenderLink.groupBy({
            by: ['tenantId'],
            where: { tenantId: { in: ids } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.defaultPlan(),
    ]);
    const subBy = new Map(subs.map((s) => [s.tenantId, s]));
    const usedBy = new Map(counts.map((c) => [c.tenantId, c._count._all]));

    return {
      items: tenants.map((t) => {
        const sub = subBy.get(t.id) ?? null;
        const plan = sub?.plan ?? defaultPlan;
        const subShape = toSubShape(sub);
        const cap = capacityStatus(toPlanShape(plan), subShape, usedBy.get(t.id) ?? 0);
        return {
          id: t.id,
          tenantId: t.id,
          tenantName: t.name,
          tenantStatus: t.status,
          subscriptionId: sub?.id ?? null,
          planKey: plan.key,
          planName: plan.name,
          status: subShape.status,
          includedClientsOverride: subShape.includedClientsOverride,
          priceOverrideMinor: subShape.priceOverrideMinor?.toString() ?? null,
          promoNote: sub?.promoNote ?? null,
          extraSlots: subShape.extraSlots,
          slotsExpireAt: subShape.slotsExpireAt,
          used: cap.used,
          capacity: cap.capacity,
          remaining: cap.remaining,
          atLimit: cap.atLimit,
        };
      }),
    };
  }

  /**
   * Platform-admin control of the flow: switch a lender's plan, customise
   * their free floor / per-slot price (promotions), or suspend/reactivate.
   * Every change is written to BillingEvent + the audit log.
   */
  async setSubscription(
    actorId: string,
    tenantId: string,
    dto: SetSubscriptionDto,
  ) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const before = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
    });
    let planId = before?.planId;
    if (dto.planKey) {
      const plan = await this.prisma.billingPlan.findUnique({
        where: { key: dto.planKey },
      });
      if (!plan) throw new NotFoundException('Plan not found');
      planId = plan.id;
    }
    if (!planId) planId = (await this.defaultPlan()).id;

    const priceOverride =
      dto.priceOverrideMinor === undefined
        ? undefined
        : dto.priceOverrideMinor === null
          ? null
          : BigInt(dto.priceOverrideMinor);

    const sub = await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId,
        status: dto.status ?? 'active',
        includedClientsOverride: dto.includedClientsOverride ?? null,
        priceOverrideMinor: priceOverride ?? null,
        promoNote: dto.promoNote ?? null,
        updatedBy: actorId,
      },
      update: {
        planId,
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.includedClientsOverride !== undefined
          ? { includedClientsOverride: dto.includedClientsOverride }
          : {}),
        ...(priceOverride !== undefined ? { priceOverrideMinor: priceOverride } : {}),
        ...(dto.promoNote !== undefined ? { promoNote: dto.promoNote } : {}),
        updatedBy: actorId,
      },
    });

    const eventType = dto.promoNote
      ? 'promotion'
      : dto.status === 'suspended'
        ? 'suspend'
        : dto.status === 'grace'
          ? 'grant_grace'
          : 'plan_change';

    await this.prisma.billingEvent.create({
      data: {
        tenantId,
        type: eventType,
        fromValue: before
          ? {
              planId: before.planId,
              status: before.status,
              includedClientsOverride: before.includedClientsOverride,
            }
          : undefined,
        toValue: {
          planId,
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.includedClientsOverride !== undefined
            ? { includedClientsOverride: dto.includedClientsOverride }
            : {}),
          ...(dto.promoNote !== undefined ? { promoNote: dto.promoNote } : {}),
        },
        actorId,
        note: dto.note ?? null,
      },
    });

    await this.audit.record({
      actorId,
      action: 'billing.subscription_set',
      entity: 'TenantSubscription',
      entityId: sub.id,
      tenantId,
      diff: { planId, status: dto.status ?? '', note: dto.note ?? '' },
    });

    const s = await this.statusFor(tenantId);
    return {
      plan: {
        key: s.plan.key,
        name: s.plan.name,
        includedClients: s.plan.includedClients,
        pricePerExtraClientMinor: s.plan.pricePerExtraClientMinor.toString(),
        pricePerExtraClient: minorToKwachaString(s.plan.pricePerExtraClientMinor),
        interval: s.plan.interval,
        active: s.plan.active,
        id: s.plan.id,
      },
      subscription: {
        status: s.subscription.status,
        includedClientsOverride: s.subscription.includedClientsOverride,
        priceOverrideMinor: s.subscription.priceOverrideMinor?.toString() ?? null,
        extraSlots: s.subscription.extraSlots,
        slotsExpireAt: s.subscription.slotsExpireAt,
        id: s.subscription.id,
        planId: s.subscription.planId,
        promoNote: s.subscription.promoNote,
      },
      capacity: s.capacity,
    };
  }

  /** Platform billing overview — MRR from live slots + recent purchases. */
  async overview() {
    const now = new Date();
    const [lenders, subs, purchases] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenantSubscription.findMany({ include: { plan: true } }),
      this.prisma.clientSlotPurchase.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    let activeSlots = 0;
    let mrrMinor = 0n;
    const byStatus: Record<string, number> = {};
    for (const s of subs) {
      byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
      const live = s.slotsExpireAt ? s.slotsExpireAt.getTime() > now.getTime() : false;
      if (live) {
        activeSlots += s.extraSlots;
        mrrMinor +=
          BigInt(s.extraSlots) *
          (s.priceOverrideMinor ?? s.plan.pricePerExtraClientMinor);
      }
    }

    return {
      lenders,
      subscriptions: subs.length,
      byStatus,
      activeSlots,
      mrrMinor: mrrMinor.toString(),
      mrr: minorToKwachaString(mrrMinor),
      recentPurchases: purchases.map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        count: p.purchasedCount,
        amountMinor: p.amountMinor.toString(),
        amount: minorToKwachaString(p.amountMinor),
        status: p.status,
        createdAt: p.createdAt,
        periodEnd: p.periodEnd,
      })),
    };
  }
}
