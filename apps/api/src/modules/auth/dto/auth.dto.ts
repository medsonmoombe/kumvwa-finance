import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({ example: '0971234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ enum: ['registration', 'login', 'password_reset'] })
  @IsIn(['registration', 'login', 'password_reset'])
  purpose!: string;
}

export class OtpVerifyDto extends OtpRequestDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class RegisterTenantDto {
  @ApiProperty({ example: '0971234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @ApiProperty({ example: 'Chilenje Community SACCO' })
  @IsString()
  businessName!: string;

  @ApiProperty({ enum: ['sacco', 'mfi', 'individual_lender', 'other'] })
  @IsIn(['sacco', 'mfi', 'individual_lender', 'other'])
  businessType!: string;

  @ApiProperty({ description: 'Token from POST /auth/otp/verify' })
  @IsString()
  otpToken!: string;

  // ── Business info (branding/billing contact) ──
  @ApiProperty({ required: false, example: 'info@sacco.zm' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: 'Plot 7, Lusaka' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiProperty({ required: false, example: '1000123456' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  tpin?: string;

  @ApiProperty({ required: false, example: 'Ms. Bwalya' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  contactPerson?: string;

  /** The platform terms version shown and agreed to in the UI. */
  @ApiProperty({ example: 1, description: 'Version of the platform terms accepted' })
  @IsInt()
  acceptedTermsVersion!: number;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: '0971234567' })
  @IsString()
  phone!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: '0971234567' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: 'Token from POST /auth/otp/verify (purpose: password_reset)' })
  @IsString()
  otpToken!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty({ description: 'The currently signed-in password' })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword!: string;
}

export class LoginDto {
  @ApiProperty({ example: '0971234567' })
  @IsString()
  phone!: string;

  @IsString()
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto extends RefreshDto {}
