import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';

export const DEFAULT_ACCOUNTS = [
  { code: '1000', name: 'Cash', type: 'asset' },
  { code: '1500', name: 'Inventory', type: 'asset' },
  { code: '2200', name: 'VAT Payable', type: 'liability' },
  { code: '4000', name: 'Sales Revenue', type: 'revenue' },
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
];

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(private databaseService: DatabaseService) {}

  private get prisma() {
    return this.databaseService.getPrisma().prisma;
  }

  // Owner self-registration: create tenant + first shop + opening balances
  async provisionStore(ownerName: string, storeName?: string) {
    const tenant = await this.prisma.tenant.create({
      data: { name: storeName || `${ownerName}'s Store` },
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: { tenantId: tenant.id, name: tenant.name },
      });
      const accounts = await this.seedAccounts(tx, tenant.id);
      await tx.tax.create({
        data: {
          tenantId: tenant.id,
          name: 'VAT',
          ratePercent: 15,
          inclusive: false,
          accountCollectedId: accounts.get('2200'),
          accountInputId: accounts.get('2200'),
        },
      });
      return shop;
    });

    this.logger.log(
      `Provisioned store ${result.id} for tenant ${tenant.id} (${tenant.name})`,
    );
    return { tenantId: tenant.id, shopId: result.id, tenantName: tenant.name };
  }

  // Invited staff: tenant must already exist; seed accounts if never used
  async ensureTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} does not exist`);
    }

    const shop = await this.prisma.shop.findFirst({ where: { tenantId } });
    if (!shop) {
      await this.prisma.shop.create({
        data: { tenantId, name: `${tenant.name} - Main Store` },
      });
    }
    await this.prisma.$transaction((tx) => this.seedAccounts(tx, tenantId));
    return { tenantId, shopId: shop?.id };
  }

  // Idempotent chart-of-accounts seeding; pass the caller's transaction when inside one
  async seedAccounts(
    tx: Prisma.TransactionClient,
    tenantId: string,
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (const acc of DEFAULT_ACCOUNTS) {
      const account = await tx.account.upsert({
        where: { tenantId_code: { tenantId, code: acc.code } },
        update: {},
        create: { tenantId, code: acc.code, name: acc.name, type: acc.type },
      });
      map.set(acc.code, account.id);
    }
    return map;
  }
}
