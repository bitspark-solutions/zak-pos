import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Shop as PrismaShop } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { CreateShopDto, UpdateShopDto } from './dto/shop.dto';
import { IShop, PaginatedShopsResult } from './interfaces/shop.interface';

// Tables that hold a shopId FK and would orphan if a shop were removed. Shops
// have no soft-delete flag in the schema, so DELETE is guarded by these refs.
const SHOP_REFERENCE_MODELS = [
  'inventory',
  'purchase',
  'sale',
  'cashSession',
  'invoice',
] as const;

type ShopReferenceModel = (typeof SHOP_REFERENCE_MODELS)[number];

@Injectable()
export class ShopsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createShopDto: CreateShopDto, tenantId: string): Promise<IShop> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const shop = await prisma.shop.create({
        data: {
          tenantId,
          name: createShopDto.name,
          address: createShopDto.address,
          timeZone: createShopDto.timeZone,
          taxProfileId: createShopDto.taxProfileId,
        },
      });

      return this.mapToShop(shop);
    });
  }

  async findAll(
    tenantId: string,
    search?: string,
  ): Promise<PaginatedShopsResult> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const where: Prisma.ShopWhereInput = { tenantId };
      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const data = await prisma.shop.findMany({
        where,
        orderBy: { createdAt: 'asc' },
      });

      return {
        data: data.map((s) => this.mapToShop(s)),
        total: data.length,
        page: 1,
        limit: data.length,
        totalPages: 1,
      };
    });
  }

  async findOne(id: string, tenantId: string): Promise<IShop> {
    const shop = await this.databaseService.withTenant(tenantId, (prisma) =>
      prisma.shop.findFirst({ where: { id, tenantId } }),
    );

    if (!shop) {
      throw new NotFoundException(`Shop with ID ${id} not found`);
    }

    return this.mapToShop(shop);
  }

  async update(
    id: string,
    updateShopDto: UpdateShopDto,
    tenantId: string,
  ): Promise<IShop> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      // findFirst scoped to tenant => foreign/absent ids yield 404, not a
      // cross-tenant write (RLS would already reject it, this makes it explicit).
      const existing = await prisma.shop.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException(`Shop with ID ${id} not found`);
      }

      const shop = await prisma.shop.update({
        where: { id: existing.id },
        data: updateShopDto,
      });

      return this.mapToShop(shop);
    });
  }

  async remove(id: string, tenantId: string): Promise<{ success: boolean }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.shop.findFirst({ where: { id, tenantId } });
      if (!existing) {
        throw new NotFoundException(`Shop with ID ${id} not found`);
      }

      const counts = await Promise.all(
        SHOP_REFERENCE_MODELS.map((model) =>
          this.countReferences(prisma, model, id),
        ),
      );
      const total = counts.reduce((sum, c) => sum + c, 0);

      if (total > 0) {
        throw new BadRequestException(
          `Shop with ID ${id} cannot be deleted: it is referenced by existing records (inventory, purchases, sales, cash sessions, or invoices).`,
        );
      }

      await prisma.shop.delete({ where: { id: existing.id } });

      return { success: true };
    });
  }

  private countReferences(
    prisma: Prisma.TransactionClient,
    model: ShopReferenceModel,
    shopId: string,
  ): Promise<number> {
    switch (model) {
      case 'inventory':
        return prisma.inventory.count({ where: { shopId } });
      case 'purchase':
        return prisma.purchase.count({ where: { shopId } });
      case 'sale':
        return prisma.sale.count({ where: { shopId } });
      case 'cashSession':
        return prisma.cashSession.count({ where: { shopId } });
      case 'invoice':
        return prisma.invoice.count({ where: { shopId } });
    }
  }

  private mapToShop(shop: PrismaShop): IShop {
    return {
      id: shop.id,
      tenantId: shop.tenantId,
      name: shop.name,
      address: shop.address,
      timeZone: shop.timeZone,
      taxProfileId: shop.taxProfileId,
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,
    };
  }
}
