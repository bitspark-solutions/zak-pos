import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { TenantSettingsService } from './tenant-settings.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { ITenantProfile } from './interfaces/tenant-settings.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Permission, Role } from '../auth/enums/permissions.enum';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get('current')
  @Roles(Role.OWNER)
  @RequirePermissions(Permission.TENANT_MANAGE)
  async getCurrent(@CurrentTenant() tenantId: string): Promise<ITenantProfile> {
    return this.tenantSettingsService.getCurrent(tenantId);
  }

  @Patch('current')
  @Roles(Role.OWNER)
  @RequirePermissions(Permission.TENANT_MANAGE)
  async updateCurrent(
    @Body() dto: UpdateTenantSettingsDto,
    @CurrentTenant() tenantId: string,
  ): Promise<ITenantProfile> {
    return this.tenantSettingsService.updateCurrent(tenantId, dto);
  }
}
