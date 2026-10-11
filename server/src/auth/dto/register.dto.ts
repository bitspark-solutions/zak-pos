import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsString()
  role?: string;

  /**
   * Invitation token from the tenant user-invitation flow. When present the
   * registration must join the inviter's tenant; a missing/expired token is a
   * hard error, never a silent fallback to self-provisioning.
   */
  @IsOptional()
  @IsString()
  inviteToken?: string;
}
