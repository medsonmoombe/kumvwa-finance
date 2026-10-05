import {
  Allow,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FLAG_DEFS } from '../platform.service';

export const VERIFICATION_DECISIONS = ['approve', 'reject'] as const;
export type VerificationDecision = (typeof VERIFICATION_DECISIONS)[number];

export class ReviewVerificationDto {
  @IsIn([...VERIFICATION_DECISIONS])
  decision!: VerificationDecision;

  /** Required by the service when rejecting; ignored on approve. */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Give a reason of at least 10 characters' })
  @MaxLength(500)
  reason?: string;
}

export class SetFlagDto {
  @IsIn(Object.keys(FLAG_DEFS))
  key!: string;

  @IsBoolean()
  value!: boolean;
}

/**
 * The general settings write. `value` stays untyped at the DTO layer because the
 * catalogue decides the shape per key — PlatformService.coerce validates it
 * against that key's type and range, which is stricter than any single
 * class-validator decorator could be for a mixed-type payload.
 */
export class SetSettingDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  key!: string;

  // @Allow, not @IsDefined: the value is deliberately untyped here and is
  // validated against the catalogue in PlatformService, which knows what each
  // key actually expects. Without a decorator the global ValidationPipe's
  // `forbidNonWhitelisted` rejects every settings write as an unknown property.
  @Allow()
  value?: unknown;
}

export class UpdateUserStatusDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}

export class UpdateTenantStatusDto {
  @IsIn(['pending_verification', 'active', 'rejected', 'suspended'])
  status!: 'pending_verification' | 'active' | 'rejected' | 'suspended';
}

