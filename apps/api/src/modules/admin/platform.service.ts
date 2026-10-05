import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';

export type SettingType = 'boolean' | 'string' | 'text' | 'number' | 'select';

export interface SettingDef {
  label: string;
  type: SettingType;
  /** Used when no override row exists, and restored by a delete. */
  default: unknown;
  group: string;
  help?: string;
  options?: readonly string[];
  min?: number;
  max?: number;
  /**
   * Whether the platform actually reads this value at runtime.
   *
   * A switch that is stored but never consulted is worse than no switch, so the
   * console badges the unenforced ones and this stays honest as the codebase
   * grows.
   */
  enforced: boolean;
}

export const SETTING_GROUPS = ['General', 'Access', 'Loans', 'Payments'] as const;

/**
 * The platform's settings catalogue — the single source of truth.
 *
 * Keys are a fixed allow-list on purpose: an operator cannot invent a setting
 * that no code reads. Adding one here is the only way to make it settable, and
 * `enforced` records whether something actually consumes it.
 */
export const SETTING_DEFS = {
  maintenance_mode: {
    label: 'Maintenance mode',
    type: 'boolean',
    default: false,
    group: 'General',
    help: 'The API answers 503 to everyone except platform admins.',
    enforced: true,
  },
  maintenance_message: {
    label: 'Maintenance message',
    type: 'text',
    default: 'Kumvwa is in scheduled maintenance. Please try again shortly.',
    group: 'General',
    help: 'Returned to users while maintenance mode is on.',
    enforced: true,
  },
  signup_enabled: {
    label: 'Business signups',
    type: 'boolean',
    default: true,
    group: 'Access',
    help: 'When off, new lender registrations are refused.',
    enforced: true,
  },
  new_registrations_require_review: {
    label: 'Force manual review',
    type: 'boolean',
    default: true,
    group: 'Access',
    help: 'New lenders wait in the verification queue instead of going active.',
    enforced: true,
  },
  client_app_enabled: {
    label: 'Client app access',
    type: 'boolean',
    default: true,
    group: 'Access',
    help: 'Not enforced yet — recorded for the client app rollout.',
    enforced: false,
  },
  cross_lender_visibility: {
    label: 'Cross-lender visibility',
    type: 'boolean',
    default: true,
    group: 'Access',
    help: 'Clients see loans from every lender they are registered with. Not enforced yet.',
    enforced: false,
  },
  max_loan_amount_minor: {
    label: 'Platform loan cap',
    type: 'number',
    default: 0,
    group: 'Loans',
    help: 'Hard ceiling in minor units (1 kwacha = 100). 0 means no platform cap.',
    min: 0,
    enforced: true,
  },
  default_payment_provider: {
    label: 'Default payment provider',
    type: 'select',
    default: 'mtn_momo',
    group: 'Payments',
    options: ['mtn_momo', 'airtel_money', 'zamtel', 'card'],
    help: 'Pre-selected provider when a payer starts a payment. Not enforced yet.',
    enforced: false,
  },
} as const satisfies Record<string, SettingDef>;

export type SettingKey = keyof typeof SETTING_DEFS;

/** The boolean subset — kept as its own export because the flag API predates
 *  the general settings catalogue and other modules import these names. */
export const FLAG_KEYS = [
  'signup_enabled',
  'client_app_enabled',
  'cross_lender_visibility',
  'new_registrations_require_review',
  'maintenance_mode',
] as const satisfies readonly (keyof typeof SETTING_DEFS)[];

export type FlagKey = (typeof FLAG_KEYS)[number];

export const FLAG_DEFS = Object.fromEntries(
  FLAG_KEYS.map((key) => [key, SETTING_DEFS[key]]),
) as Record<FlagKey, SettingDef>;

/** Values are read on hot paths (every guarded request), so keep the
 *  catalogue + overrides in memory briefly instead of hitting the DB per call. */
const CACHE_TTL_MS = 5_000;

export interface SettingItem {
  key: string;
  label: string;
  type: SettingType;
  group: string;
  help?: string;
  options?: readonly string[];
  min?: number;
  max?: number;
  enforced: boolean;
  value: unknown;
  default: unknown;
  isDefault: boolean;
}

@Injectable()
export class PlatformService {
  private cache: { at: number; rows: Map<string, unknown> } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── reads ────────────────────────────────────────────────────────────────

  private def(key: string): SettingDef {
    const def = (SETTING_DEFS as Record<string, SettingDef>)[key];
    if (!def) throw new BadRequestException(`Unknown setting: ${key}`);
    return def;
  }

  private async overrides(): Promise<Map<string, unknown>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_TTL_MS) return this.cache.rows;
    const rows = await this.prisma.platformConfig.findMany();
    const map = new Map(rows.map((r) => [r.key, r.value as unknown]));
    this.cache = { at: Date.now(), rows: map };
    return map;
  }

  private invalidate() {
    this.cache = null;
  }

  private item(key: string, overrides: Map<string, unknown>): SettingItem {
    const def = this.def(key);
    const isSet = overrides.has(key);
    return {
      key,
      label: def.label,
      type: def.type,
      group: def.group,
      ...(def.help ? { help: def.help } : {}),
      ...(def.options ? { options: def.options } : {}),
      ...(def.min === undefined ? {} : { min: def.min }),
      ...(def.max === undefined ? {} : { max: def.max }),
      enforced: def.enforced,
      value: isSet ? overrides.get(key) : def.default,
      default: def.default,
      isDefault: !isSet,
    };
  }

  /** Every setting, grouped in catalogue order, with overrides applied. */
  async list(): Promise<{ items: SettingItem[]; groups: readonly string[] }> {
    const overrides = await this.overrides();
    return {
      items: Object.keys(SETTING_DEFS).map((key) => this.item(key, overrides)),
      groups: SETTING_GROUPS,
    };
  }

  async get(key: string): Promise<SettingItem> {
    return this.item(key, await this.overrides());
  }

  /** Typed read for consumers (guards, services). Falls back to the default. */
  async value<T>(key: SettingKey): Promise<T> {
    const overrides = await this.overrides();
    const def = this.def(key);
    return (overrides.has(key) ? (overrides.get(key) as T) : (def.default as T));
  }

  // ── writes ───────────────────────────────────────────────────────────────

  /**
   * Validates against the catalogue, so a typo'd type or an out-of-range number
   * is refused rather than stored and silently ignored.
   */
  private coerce(key: string, raw: unknown): unknown {
    const def = this.def(key);
    switch (def.type) {
      case 'boolean':
        if (typeof raw !== 'boolean') throw new BadRequestException(`${key} must be a boolean`);
        return raw;
      case 'number': {
        const n = typeof raw === 'string' ? Number(raw) : raw;
        if (typeof n !== 'number' || !Number.isFinite(n)) {
          throw new BadRequestException(`${key} must be a number`);
        }
        if (def.min !== undefined && n < def.min) {
          throw new BadRequestException(`${key} must be at least ${def.min}`);
        }
        if (def.max !== undefined && n > def.max) {
          throw new BadRequestException(`${key} must be at most ${def.max}`);
        }
        return n;
      }
      case 'select':
        if (typeof raw !== 'string' || !def.options?.includes(raw)) {
          throw new BadRequestException(`${key} must be one of: ${def.options?.join(', ')}`);
        }
        return raw;
      case 'string':
      case 'text': {
        if (typeof raw !== 'string') throw new BadRequestException(`${key} must be text`);
        const limit = def.type === 'text' ? 2000 : 200;
        if (raw.length > limit) {
          throw new BadRequestException(`${key} must be ${limit} characters or fewer`);
        }
        return raw;
      }
    }
  }

  /**
   * Create-or-update. One method for both because an override row is created
   * lazily — writing a setting for the first time *is* its creation.
   */
  async set(key: string, raw: unknown, actorId: string): Promise<SettingItem> {
    const before = await this.get(key);
    const value = this.coerce(key, raw);
    if (JSON.stringify(before.value) === JSON.stringify(value)) return before;

    await this.prisma.platformConfig.upsert({
      where: { key },
      create: { key, value: value as never, updatedBy: actorId },
      update: { value: value as never, updatedBy: actorId },
    });
    this.invalidate();

    await this.audit.record({
      actorId,
      action: 'platform.setting_set',
      entity: 'PlatformConfig',
      entityId: key,
      diff: { key, from: before.value, to: value },
    });
    return this.get(key);
  }

  /** Drop the override so the catalogue default applies again. */
  async remove(key: string, actorId: string): Promise<SettingItem> {
    const before = await this.get(key);
    if (before.isDefault) return before;

    await this.prisma.platformConfig.deleteMany({ where: { key } });
    this.invalidate();

    await this.audit.record({
      actorId,
      action: 'platform.setting_reset',
      entity: 'PlatformConfig',
      entityId: key,
      diff: { key, from: before.value, to: before.default },
    });
    return this.get(key);
  }

  /** Restore every setting to its default in one audited action. */
  async restoreDefaults(actorId: string): Promise<{ items: SettingItem[] }> {
    const before = await this.list();
    const changed = before.items.filter((i) => !i.isDefault);
    if (changed.length > 0) {
      await this.prisma.platformConfig.deleteMany({
        where: { key: { in: changed.map((i) => i.key) } },
      });
      this.invalidate();
      await this.audit.record({
        actorId,
        action: 'platform.settings_restored',
        entity: 'PlatformConfig',
        diff: { keys: changed.map((i) => i.key) },
      });
    }
    return this.list();
  }

  // ── the older boolean-flag API, now backed by the catalogue ──────────────

  async allFlags() {
    const { items } = await this.list();
    return {
      items: items
        .filter((i) => i.type === 'boolean')
        .map((i) => ({ key: i.key, label: i.label, value: i.value, isDefault: i.isDefault })),
    };
  }

  async setFlag(key: string, value: boolean, actorId: string) {
    const item = await this.set(key, value, actorId);
    return { key, value: item.value };
  }

  /** Guards/consumers read this — cached for a few seconds. */
  async getFlag(key: FlagKey): Promise<boolean> {
    return this.value<boolean>(key);
  }
}
