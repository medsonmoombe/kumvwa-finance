import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  /** Registration supplies this before a user record exists. */
  @IsOptional()
  @IsEmail()
  email?: string;
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
  @IsNotEmpty({ message: 'Phone number is required' })
  phone!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @ApiProperty({ example: 'Chilenje Community SACCO' })
  @IsString()
  @IsNotEmpty({ message: 'Business name is required' })
  @MaxLength(160)
  businessName!: string;

  @ApiProperty({ enum: ['sacco', 'mfi', 'individual_lender', 'other'] })
  @IsIn(['sacco', 'mfi', 'individual_lender', 'other'])
  businessType!: string;

  @ApiProperty({
    required: false,
    description: 'Token from POST /auth/otp/verify. Optional — console sign-up has no SMS step.',
  })
  @IsOptional()
  @IsString()
  otpToken?: string;

  // ── Business info (branding/billing contact) ──
  @ApiProperty({ example: 'info@sacco.zm' })
  @IsEmail({}, { message: 'Enter a valid business email address' })
  email!: string;

  @ApiProperty({ required: false, example: 'Plot 7, Lusaka' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiProperty({ example: '1000123456' })
  @IsString()
  @IsNotEmpty({ message: 'TPIN is required' })
  @MaxLength(20)
  tpin!: string;

  /**
   * The human Kumvwa contacts about this business. Required: the reviewer
   * reviews this person as the accountable business contact. An approval
   * without a named contact is not a reviewable application.
   */
  @ApiProperty({ example: 'Ms. Bwalya' })
  @IsString()
  @IsNotEmpty({ message: 'Contact person is required' })
  @MaxLength(120)
  contactPerson!: string;

  @ApiProperty({
    example: 'Community SACCO providing short-term working-capital loans in Lusaka.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Business description is required' })
  @MinLength(20, { message: 'Business description must be at least 20 characters' })
  @MaxLength(1000)
  businessDescription!: string;

  /** Identity number for the named contact person. */
  @ApiProperty({ example: '245711/63/1' })
  @IsString()
  @Matches(/^\d{6}\/\d{2}\/\d$/, {
    message: 'Enter a valid contact person NRC, e.g. 245711/63/1',
  })
  ownerNrc!: string;

  /** The platform terms version shown and agreed to in the UI. */
  @ApiProperty({ example: 1, description: 'Version of the platform terms accepted' })
  @IsInt()
  acceptedTermsVersion!: number;
}

export class ForgotPasswordDto {
  @ApiProperty({ required: false, example: 'user@yourbusiness.zm' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '0971234567' })
  @IsOptional()
  @IsString()
  phone?: string;
}

export class ResetPasswordDto {
  @ApiProperty({ required: false, example: 'user@yourbusiness.zm' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: '0971234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: '123456' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code?: string;

  @ApiProperty({ required: false, description: 'Token from POST /auth/otp/verify (if phone flow)' })
  @IsOptional()
  @IsString()
  otpToken?: string;

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

export class ConsoleLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceLabel?: string;
}

export class ConsoleVerifyDto {
  @IsString()
  preToken!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code!: string;

  @IsOptional()
  @IsBoolean()
  rememberDevice?: boolean;
}

export class RedeemMobileAccessCodeDto {
  @IsString()
  @MinLength(16)
  @MaxLength(32)
  code!: string;
}

export class Set2faDto {
  @IsBoolean()
  enabled!: boolean;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}

export class LogoutDto extends RefreshDto {}
