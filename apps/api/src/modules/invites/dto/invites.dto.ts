import {
  IsBoolean,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInviteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  clientName!: string;

  @IsString()
  phone!: string;

  /** The invite is delivered by email — required (no SMS channel yet). */
  @IsEmail()
  email!: string;
}

/**
 * Option-A onboarding: the invite code only mints the ACCOUNT (name +
 * password). KYC (NRC / DOB / address) is completed post-login in the
 * app's profile wizard — see PATCH /clients/me/profile.
 */
export class CompleteInviteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password!: string;

  @IsBoolean()
  consent!: boolean;
}
