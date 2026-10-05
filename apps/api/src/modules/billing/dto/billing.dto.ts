import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const SUBSCRIPTION_STATUSES = [
  'active',
  'past_due',
  'grace',
  'suspended',
  'cancelled',
] as const;
export type SubscriptionStatusName = (typeof SUBSCRIPTION_STATUSES)[number];

export class CreatePlanDto {
  /** Stable slug, e.g. 'free' — referenced by subscriptions. */
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  /** Free floor: clients included before extra slots are needed. */
  @IsInt()
  @Min(0)
  @Max(100_000)
  includedClients!: number;

  /** Monthly price of ONE extra client slot, in ngwee (K100 = 10000). */
  @IsInt()
  @Min(0)
  pricePerExtraClientMinor!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  includedClients?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerExtraClientMinor?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

/**
 * Platform-admin override for one lender: switch plan, customise the free
 * floor and/or the per-slot price (promotions), or suspend/reactivate.
 * `null` clears an override (e.g. promoting a lender back to the plan default).
 */
export class SetSubscriptionDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  planKey?: string;

  @IsOptional()
  @IsIn([...SUBSCRIPTION_STATUSES])
  status?: SubscriptionStatusName;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  includedClientsOverride?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceOverrideMinor?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  promoNote?: string;

  /** Audit note for the change (shown on the platform billing log). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class QuoteSlotsDto {
  @IsInt()
  @Min(1)
  @Max(10_000)
  @Type(() => Number)
  count!: number;
}
