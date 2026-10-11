import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

// Tenant self-service editable subset. The `Tenant` model exposes only
// name/plan/status besides timestamps; plan and status are lifecycle/billing
// fields owned by the platform (not tenant-editable), so `name` is the only
// writable field here.
export class UpdateTenantSettingsDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  name?: string;
}
