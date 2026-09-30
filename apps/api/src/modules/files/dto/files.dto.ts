import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const FILE_KINDS = [
  'boz_certificate',
  'kyc_document',
  'nrc_photo',
  'tenant_logo',
  'profile_image',
  'other',
] as const;
export type FileKindName = (typeof FILE_KINDS)[number];

/** 10 MB — generous for a scanned certificate, tight enough to bound abuse. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export class CreateUploadUrlDto {
  @IsIn([...FILE_KINDS])
  kind!: FileKindName;

  @IsIn([...ALLOWED_MIMES], {
    message: 'Only PDF, JPEG or PNG documents are accepted',
  })
  mime!: string;

  /** Size is declared up front and re-checked against storage on confirm. */
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES, { message: 'File must be 10 MB or smaller' })
  size!: number;
}

export class LocalStorageParamDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  expires!: string;

  @IsString()
  @IsNotEmpty()
  sig!: string;

  @IsOptional()
  @IsString()
  mime?: string;
}

