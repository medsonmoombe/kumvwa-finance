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
}
