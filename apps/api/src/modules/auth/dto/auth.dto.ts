import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

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
