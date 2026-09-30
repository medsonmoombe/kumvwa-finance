import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  MaxLength,
} from 'class-validator';

export class SubmitVerificationDto {
  /** `fileId` from POST /files/upload-url → PUT → POST /files/:id/confirm. */
  @IsString()
  @IsNotEmpty()
  fileId!: string;

  /** Zambian NRC, e.g. 245711/63/1 — checked by the reviewer against the certificate. */
  @IsString()
  @Matches(/^\d{6}\/\d{2}\/\d$/, {
    message: 'Enter a valid NRC number, e.g. 245711/63/1',
  })
  ownerNrc!: string;
}

/** Re-enters a rejected business into review without requiring a new BOZ file. */
export class ResubmitVerificationDto {
  @IsString()
  @Matches(/^\d{6}\/\d{2}\/\d$/, {
    message: 'Enter a valid NRC number, e.g. 245711/63/1',
  })
  ownerNrc!: string;
}

/** Editable business record for a rejected application. */
export class UpdateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  businessName!: string;

  @IsIn(['sacco', 'mfi', 'individual_lender', 'other'])
  businessType!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  tpin!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contactPerson!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  businessDescription!: string;
}

/** White-label branding + business info set from the console. */
export class UpdateBrandingDto {
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primaryColor must be a hex color like #1A4FBF',
  })
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tagline?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  tpin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  businessDescription?: string;

  @IsOptional()
  @IsString()
  logoFileId?: string;
}
