import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsString() @MinLength(2) @MaxLength(120)
  displayName!: string;

  @IsString()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString() @MinLength(8)
  password!: string;

  @IsString()
  roleId!: string;
}

export class UpdateStaffDto {
  @IsOptional() @IsString()
  roleId?: string;

  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class CreateRoleDto {
  @IsString() @MinLength(2) @MaxLength(80)
  name!: string;

  @IsArray() @IsString({ each: true })
  permissions!: string[];
}

export class UpdateRoleDto extends CreateRoleDto {}
