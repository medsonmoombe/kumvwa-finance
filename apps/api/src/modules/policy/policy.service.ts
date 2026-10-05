import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  DEFAULT_CREDIT_POLICY,
  orderedTiers,
  resolveCreditLimit,
  type BorrowerStats,
  type CreditPolicy,
} from '@kumvwa/core';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsObject,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';

class TierDto {
  @IsInt()
  @Min(0)
  clearedFrom!: number;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  @Min(1)
  limitKwacha!: number;

  @IsInt()
  @Min(1)
  maxTermMonths!: number;
}

class RulesDto {
  @IsInt()
  @Min(1)
  maxActiveLoans!: number;

  @IsBoolean()
  blockIfOverdue!: boolean;

  @IsInt()
  @Min(0)
  cooldownDaysAfterDefault!: number;
}

export class PublishPolicyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  tiers!: TierDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => RulesDto)
  rules!: RulesDto;
}

export class OverrideDto {
  @IsInt()
  @Min(1)
  limitKwacha!: number;

  @IsString()
  @MinLength(5)
  reason!: string;
}

/**
 * Lending rules (M5): the tenant's credit ladder + per-client overrides.
 * The pure math lives in @kumvwa/core (`resolveCreditLimit`) so app, API and
 * property tests agree — this is the storage + enforcement surface.
 *
 * Semantics (locked): the ladder counts cleared loans WITH THIS LENDER
 * (relationship lending); hard blocks (overdue/defaulted) are platform-wide.
 */
@Injectable()
export class PolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getPolicy(tenantId: string): Promise<CreditPolicy> {
    const row = await this.prisma.creditPolicy.findUnique({
      where: { tenantId },
    });
    return (row?.policy as unknown as CreditPolicy) ?? DEFAULT_CREDIT_POLICY;
  }

  /** Console tab: the ladder in force + its published version. */
  async getWithVersion(tenantId: string) {
    const row = await this.prisma.creditPolicy.findUnique({
      where: { tenantId },
    });
    return {
      policy: (row?.policy as unknown as CreditPolicy) ?? DEFAULT_CREDIT_POLICY,
      version: row?.version ?? 0,
    };
  }

  async publish(tenantId: string, actorId: string, dto: PublishPolicyDto) {
    const policy: CreditPolicy = { tiers: dto.tiers, rules: dto.rules };
    // Validate through the SAME function the enforcement path uses: an
    // invalid ladder can never be published.
    try {
      resolveCreditLimit(
        policy,
        {
          clearedCount: 0,
          pendingRequestCount: 0,
          activeCount: 0,
          overdueCount: 0,
          defaultedCount: 0,
          defaultedAt: null,
        },
        null,
      );
    } catch (e) {
      throw new BadRequestException(
        `Invalid policy: ${e instanceof Error ? e.message : 'invalid'}`,
      );
    }

    const prev = await this.prisma.creditPolicy.findUnique({
      where: { tenantId },
    });
    // Store the rungs in ascending order. Resolution no longer depends on it,
    // but canonical storage means the JSON a lender downloads, the console
    // renders and the engine evaluates can never disagree.
    const canonical: CreditPolicy = { ...policy, tiers: orderedTiers(policy) };
    const saved = await this.prisma.creditPolicy.upsert({
      where: { tenantId },
      create: { tenantId, version: 1, policy: canonical as unknown as Prisma.InputJsonValue },
      update: {
        version: (prev?.version ?? 0) + 1,
        policy: canonical as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });
    await this.audit.record({
      actorId,
      action: 'policy.publish',
      entity: 'CreditPolicy',
      entityId: saved.id,
      tenantId,
      diff: { version: saved.version },
    });
    return { version: saved.version };
  }

  /**
   * Resolve the borrower's limit for ONE lender. `lenderId` optional for the
   * client's own banner (falls back to their first linked lender).
   */
  async resolve(clientId: string, lenderId?: string) {
    let tenantId = lenderId;
    if (!tenantId) {
      const link = await this.prisma.clientLenderLink.findFirst({
        where: { clientId },
        orderBy: { createdAt: 'asc' },
      });
      if (!link) {
        return {
          limitKwacha: 0,
          tier: 'blocked',
          maxTermMonths: 0,
          blockedReason: 'No lender is linked to your profile yet',
          policyVersion: 0,
          nextTier: null,
        };
      }
      tenantId = link.tenantId;
    }

    const [policy, loans, override, policyRow, pendingCount] =
      await Promise.all([
        this.getPolicy(tenantId),
        this.prisma.loan.findMany({
          where: { clientId },
          select: { tenantId: true, status: true, updatedAt: true },
        }),
        this.prisma.clientLimitOverride.findFirst({
          where: { clientId, tenantId, active: true },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.creditPolicy.findUnique({ where: { tenantId } }),
        // Platform-wide: any pending application blocks a new one anywhere.
        this.prisma.loanRequest.count({
          where: { clientId, status: 'pending' },
        }),
      ]);

    const withThis = loans.filter((l) => l.tenantId === tenantId);
    const defaulted = loans
      .filter((l) => l.status === 'defaulted')
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

    const stats: BorrowerStats = {
      clearedCount: withThis.filter((l) => l.status === 'cleared').length,
      pendingRequestCount: pendingCount,
      activeCount: withThis.filter((l) => l.status === 'active').length,
      // Risk hygiene is platform-wide: an overdue loan anywhere blocks.
      overdueCount: loans.filter((l) => l.status === 'overdue').length,
      defaultedCount: defaulted ? 1 : 0,
      defaultedAt: defaulted?.updatedAt.toISOString() ?? null,
    };

    const resolution = resolveCreditLimit(
      policy,
      stats,
      override
        ? { limitKwacha: override.limitKwacha, reason: override.reason }
        : null,
    );
    return { ...resolution, policyVersion: policyRow?.version ?? 0 };
  }

  /** Console drawer: resolution + every override (active and past). */
  async clientCredit(tenantId: string, clientId: string) {
    const link = await this.prisma.clientLenderLink.findUnique({
      where: { clientId_tenantId: { clientId, tenantId } },
    });
    if (!link) throw new NotFoundException('Client not in your book');
    const resolution = await this.resolve(clientId, tenantId);
    const overrides = await this.prisma.clientLimitOverride.findMany({
      where: { clientId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return { ...resolution, overrides };
  }

  async grantOverride(
    tenantId: string,
    actorId: string,
    clientId: string,
    dto: OverrideDto,
  ) {
    const link = await this.prisma.clientLenderLink.findUnique({
      where: { clientId_tenantId: { clientId, tenantId } },
    });
    if (!link) throw new NotFoundException('Client not in your book');

    const policy = await this.getPolicy(tenantId);
    // Must match resolveCreditLimit's ceiling exactly, or a lender could be
    // refused an override that the resolution would happily have honoured.
    const ceiling = Math.max(...policy.tiers.map((t) => t.limitKwacha));
    if (dto.limitKwacha > ceiling) {
      throw new ForbiddenException(`Above your policy ceiling of K${ceiling}`);
    }

    // One active override per client+lender: granting supersedes the last.
    await this.prisma.clientLimitOverride.updateMany({
      where: { clientId, tenantId, active: true },
      data: { active: false },
    });
    const o = await this.prisma.clientLimitOverride.create({
      data: {
        clientId,
        tenantId,
        limitKwacha: dto.limitKwacha,
        reason: dto.reason,
        grantedBy: actorId,
      },
    });
    await this.audit.record({
      actorId,
      action: 'policy.override_grant',
      entity: 'ClientLimitOverride',
      entityId: o.id,
      tenantId,
      diff: { clientId, limitKwacha: dto.limitKwacha, reason: dto.reason },
    });
    return { overrideId: o.id, limitKwacha: o.limitKwacha };
  }

  async revokeOverride(tenantId: string, actorId: string, overrideId: string) {
    const o = await this.prisma.clientLimitOverride.findUnique({
      where: { id: overrideId },
    });
    if (!o || o.tenantId !== tenantId) throw new NotFoundException();
    await this.prisma.clientLimitOverride.update({
      where: { id: o.id },
      data: { active: false },
    });
    await this.audit.record({
      actorId,
      action: 'policy.override_revoke',
      entity: 'ClientLimitOverride',
      entityId: o.id,
      tenantId,
      diff: { clientId: o.clientId },
    });
    return { revoked: true };
  }
}
