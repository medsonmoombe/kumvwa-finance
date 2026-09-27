import {
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

export class UpdateUserStatusDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}

export class UpdateTenantStatusDto {
  @IsIn(['pending_verification', 'active', 'rejected', 'suspended'])
  status!: 'pending_verification' | 'active' | 'rejected' | 'suspended';
}

