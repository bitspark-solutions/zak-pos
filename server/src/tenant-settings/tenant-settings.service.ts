import { Injectable, NotFoundException } from '@nestjs/common';
import { Tenant as PrismaTenant } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';
import { ITenantProfile } from './interfaces/tenant-settings.interface';

@Injectable()
export class TenantSettingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getCurrent(tenantId: string): Promise<ITenantProfile> {
    const tenant = await this.databaseService.withTenant(tenantId, (prisma) =>
      prisma.tenant.findFirst({ where: { id: tenantId } }),
    );

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.mapToProfile(tenant);
  }

  async updateCurrent(
    tenantId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<ITenantProfile> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.tenant.findFirst({
        where: { id: tenantId },
      });
      if (!existing) {
        throw new NotFoundException('Tenant not found');
      }

      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { name: dto.name },
      });

      return this.mapToProfile(tenant);
    });
  }

  private mapToProfile(tenant: PrismaTenant): ITenantProfile {
    return {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
