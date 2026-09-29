import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';

export interface AuditEntry {
  actorId?: string;
  action: string;
  description?: string;
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
          description: entry.description,
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

  /** Derive a simple severity tier from the action string. */
  private sev(action: string): 'info' | 'warn' | 'critical' {
    if (/delete|suspend|reject|revoke|disable|block/i.test(action)) return 'critical';
    if (/update|patch|reset|override|flag/i.test(action)) return 'warn';
    return 'info';
  }

  private readonly SELECT_CONSOLE = {
    id: true,
    actorId: true,
    action: true,
    description: true,
    entity: true,
    entityId: true,
    tenantId: true,
    diff: true,
    ip: true,
    userAgent: true,
    createdAt: true,
  } as const;

  private async enrich(rows: Array<{
    id: string; actorId: string | null; action: string; description: string | null;
    entity: string | null; entityId: string | null; tenantId: string | null;
    diff: unknown; ip: string | null; userAgent: string | null; createdAt: Date;
  }>) {
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
    const tenantIds = [...new Set(rows.map((r) => r.tenantId).filter(Boolean))] as string[];

    const [users, tenants] = await Promise.all([
      actorIds.length
        ? this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, displayName: true, role: true } })
        : [],
      tenantIds.length
        ? this.prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true } })
        : [],
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const tenantMap = new Map(tenants.map((t) => [t.id, t]));

    return rows.map((row) => ({
      id: row.id,
      actor: userMap.get(row.actorId ?? '')?.displayName ?? row.actorId ?? 'system',
      actorRole: userMap.get(row.actorId ?? '')?.role ?? 'unknown',
      tenantId: row.tenantId,
      tenantName: tenantMap.get(row.tenantId ?? '')?.name ?? null,
      action: row.action,
      description: row.description,
      resource: row.entity ?? 'system',
      resourceId: row.entityId,
      severity: this.sev(row.action),
      ip: row.ip,
      userAgent: row.userAgent,
      meta: row.diff as Record<string, unknown> | null,
      createdAt: row.createdAt,
    }));
  }

  async listConsole(tenantId: string, severity?: string, take = 100) {
    const rows = await this.prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      select: this.SELECT_CONSOLE,
    });
    const items = await this.enrich(rows);
    return { items: severity ? items.filter((i) => i.severity === severity) : items };
  }

  async listAdminConsole(filters: {
    severity?: string; action?: string; entity?: string; tenantId?: string; take?: number;
  }) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(filters.action ? { action: { startsWith: filters.action } } : {}),
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(filters.take ?? 100, 1), 200),
      select: this.SELECT_CONSOLE,
    });
    const items = await this.enrich(rows);
    return { items: filters.severity ? items.filter((i) => i.severity === filters.severity) : items };
  }

  async getOne(id: string, tenantId?: string) {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      select: this.SELECT_CONSOLE,
    });
    if (!row) throw new NotFoundException('Audit event not found');
    return (await this.enrich([row]))[0];
  }

  async stats(tenantId?: string) {
    const where = tenantId ? { tenantId } : {};
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [total, today, all] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.count({ where: { ...where, createdAt: { gte: todayStart } } }),
      this.prisma.auditLog.findMany({ where, select: { action: true }, take: 1000, orderBy: { createdAt: 'desc' } }),
    ]);
    let warn = 0, critical = 0;
    for (const r of all) {
      const s = this.sev(r.action);
      if (s === 'warn') warn++;
      else if (s === 'critical') critical++;
    }
    return { total, today, warn, critical };
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
        ...(action ? { action: { startsWith: action } } : {}),
        ...(filters.entity ? { entity: filters.entity } : {}),
        ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(filters.take ?? 100, 1), 200),
      select: {
        id: true, actorId: true, action: true, entity: true,
        entityId: true, tenantId: true, diff: true, ip: true, createdAt: true,
      },
    });
  }
}
