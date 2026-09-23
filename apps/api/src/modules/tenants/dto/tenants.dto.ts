import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
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
  logoFileId?: string;
}
