import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';

/** The flags that exist and their shapes — unknown keys are rejected. */
export const FLAG_DEFS = {
  signup_enabled: { label: 'Business signups', type: 'boolean', default: true },
  client_app_enabled: { label: 'Client app access', type: 'boolean', default: true },
  cross_lender_visibility: {
    label: 'Cross-lender visibility (clients see loans from all their lenders)',
    type: 'boolean',
    default: true,
  },
  new_registrations_require_review: {
    label: 'Force manual BOZ review (always true in prod)',
    type: 'boolean',
    default: true,
  },
  maintenance_mode: {
    label: 'Maintenance mode (API returns 503 except admins)',
    type: 'boolean',
    default: false,
  },
} as const;

export type FlagKey = keyof typeof FLAG_DEFS;

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async allFlags() {
    const rows = await this.prisma.platformConfig.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value as boolean]));
    return {
      items: Object.entries(FLAG_DEFS).map(([key, def]) => ({
        key,
        label: def.label,
        value: (map.get(key) as boolean | undefined) ?? def.default,
        isDefault: !map.has(key),
      })),
    };
  }

  async setFlag(key: string, value: boolean, actorId: string) {
    if (!(key in FLAG_DEFS)) throw new BadRequestException(`Unknown flag: ${key}`);
    if (typeof value !== 'boolean') throw new BadRequestException('Value must be boolean');

    const before = await this.allFlags();
    await this.prisma.platformConfig.upsert({
      where: { key },
      create: { key, value, updatedBy: actorId },
      update: { value, updatedBy: actorId },
    });

    await this.audit.record({
      actorId,
      action: 'platform.flag_set',
      entity: 'PlatformConfig',
      entityId: key,
      diff: { from: before.items.find((i) => i.key === key)?.value, to: value },
    });
    return { key, value };
  }

  /** Guards/consumers read this — cached at the caller or fetched directly. */
  async getFlag(key: FlagKey): Promise<boolean> {
    const row = await this.prisma.platformConfig.findUnique({ where: { key } });
    return (row?.value as boolean | undefined) ?? FLAG_DEFS[key].default;
  }
}
