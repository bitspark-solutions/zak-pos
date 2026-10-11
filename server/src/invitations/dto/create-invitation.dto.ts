import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { Role } from '../../auth/enums/permissions.enum';

/**
 * Roles an inviter may grant to a new tenant member. `admin` is a platform
 * role (manages tenants) and can never be handed out through a tenant
 * invitation, so it is intentionally excluded from the whitelist.
 */
export const INVITABLE_ROLES: Role[] = [Role.OWNER, Role.MANAGER, Role.CASHIER];

export class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsIn(INVITABLE_ROLES)
  role: Role;

  @IsOptional()
  @IsString()
  shopId?: string;
}
