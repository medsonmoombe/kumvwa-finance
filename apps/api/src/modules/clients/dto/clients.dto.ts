import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** NRC is required for completion; DOB/address ride along when provided. */
export class UpdateClientProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(20)
  nrc?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;
}

/**
 * First-login profile stepper — the richer profile the lender's KYC review
 * consumes. Distinct from the NRC/DOB/address wizard above so the original
 * KYC endpoint keeps working untouched.
 */
export class UpdateProfileDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['formal_employment', 'self_employed', 'farming', 'informal', 'other'])
  employmentStatus?: string;

  @IsOptional()
  @IsIn(['primary', 'junior_secondary', 'senior_secondary', 'certificate', 'diploma', 'degree', 'postgraduate', 'none'])
  educationLevel?: string;

  @IsOptional()
  @IsIn(['b0_1000', 'b1001_3000', 'b3001_6000', 'b6000_plus'])
  incomeBand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  incomeSource?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  kinName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  kinPhone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  kin2Name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  kin2Phone?: string;

  @IsOptional()
  @IsString()
  nrcPhotoFileId?: string;

  @IsOptional()
  @IsString()
  nrcBackPhotoFileId?: string;
}
