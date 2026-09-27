import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';

export interface AuditEntry {
  actorId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  tenantId?: string;
  diff?: unknown;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-observe: an audit failure must never break the business
   * operation, but it MUST be loudly visible in logs.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          tenantId: entry.tenantId,
          diff: entry.diff === undefined ? undefined : (entry.diff as object),
          ip: entry.ip,
          userAgent: entry.userAgent,
        },
      });
    } catch (e) {
      this.logger.error({ err: e, entry }, 'AUDIT WRITE FAILED');
    }
  }

  list(tenantId?: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      select: {
        id: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        tenantId: true,
        diff: true,
        ip: true,
        createdAt: true,
      },
    });
  }

  /** C4: the platform admin viewer — action prefix / entity / tenant filters. */
  listFiltered(filters: {
    action?: string;
    entity?: string;
    tenantId?: string;
    take?: number;
  }) {
    const action = filters.action;
    return this.prisma.auditLog.findMany({
      where: {
        ...(action
          ? { action: { startsWith: action } }
          : {}),
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(filters.take ?? 100, 1), 200),
      select: {
        id: true,
        actorId: true,
        action: true,
        entity: true,
        entityId: true,
        tenantId: true,
        diff: true,
        ip: true,
        createdAt: true,
      },
    });
  }
}
