import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import {
  StockQueryDto,
  AdjustStockDto,
  InventoryMovementQueryDto,
} from './dto/inventory.dto';
import {
  IInventoryWithProduct,
  IInventoryMovement,
  StockCheckResult,
} from './interfaces/inventory.interface';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getStock(
    query: StockQueryDto,
    tenantId: string,
  ): Promise<IInventoryWithProduct[]> {
    const where: Prisma.InventoryWhereInput = {
      product: { tenantId },
    };

    if (query.shopId) where.shopId = query.shopId;
    if (query.productId) where.productId = query.productId;
    if (query.variantId) where.variantId = query.variantId;

    const inventory = await this.databaseService.withTenant(
      tenantId,
      (prisma) =>
        prisma.inventory.findMany({
          where,
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
              },
            },
            variant: {
              select: {
                id: true,
                attributes: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
    );

    return inventory.map((inv) => ({
      id: inv.id,
      shopId: inv.shopId,
      productId: inv.productId,
      variantId: inv.variantId,
      quantityOnHand: Number(inv.quantityOnHand),
      valuationMethod: inv.valuationMethod,
      avgCost: Number(inv.avgCost),
      updatedAt: inv.updatedAt,
      product: inv.product,
      variant: inv.variant
        ? {
            id: inv.variant.id,
            attributes:
              (inv.variant.attributes as Record<string, string>) ?? null,
          }
        : undefined,
    }));
  }

  async getStockForProducts(
    shopId: string,
    productIds: string[],
    tenantId: string,
  ): Promise<StockCheckResult[]> {
    const inventory = await this.databaseService.withTenant(
      tenantId,
      (prisma) =>
        prisma.inventory.findMany({
          where: {
            shopId,
            productId: { in: productIds },
            product: { tenantId },
          },
        }),
    );

    // Create a map for quick lookup
    const stockMap = new Map<string, number>();
    inventory.forEach((inv) => {
      const key = `${inv.productId}-${inv.variantId || 'no-variant'}`;
      stockMap.set(key, Number(inv.quantityOnHand));
    });

    return productIds.map((productId) => ({
      productId,
      available: stockMap.get(`${productId}-no-variant`) || 0,
      reserved: 0,
      quantityOnHand: stockMap.get(`${productId}-no-variant`) || 0,
    }));
  }

  async adjustStock(
    dto: AdjustStockDto,
    tenantId: string,
    _userId?: string,
  ): Promise<any> {
    return this.databaseService.withTenant(tenantId, async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: dto.productId, tenantId },
      });
      if (!product) {
        throw new NotFoundException(
          `Product with ID ${dto.productId} not found`,
        );
      }

      // Get or create inventory record
      let inventory = await tx.inventory.findFirst({
        where: {
          shopId: dto.shopId,
          productId: dto.productId,
          variantId: dto.variantId || null,
        },
      });

      let newQuantity: number;
      let newAvgCost: number;

      if (!inventory) {
        // Create new inventory record
        if (dto.type !== 'IN') {
          throw new BadRequestException(
            'Cannot adjust stock for non-existent inventory',
          );
        }
        newQuantity = dto.quantity;
        newAvgCost = dto.unitCost || 0;

        // Create the inventory record
        inventory = await tx.inventory.create({
          data: {
            shopId: dto.shopId,
            productId: dto.productId,
            variantId: dto.variantId || null,
            quantityOnHand: newQuantity,
            avgCost: newAvgCost,
          },
        });
      } else {
        const currentQty = Number(inventory.quantityOnHand);

        switch (dto.type) {
          case 'IN':
            newQuantity = currentQty + dto.quantity;
            // Recalculate average cost
            if (dto.unitCost) {
              const totalCost =
                Number(inventory.avgCost) * currentQty +
                dto.unitCost * dto.quantity;
              newAvgCost = totalCost / newQuantity;
            } else {
              newAvgCost = Number(inventory.avgCost);
            }
            break;
          case 'OUT':
            newQuantity = currentQty - dto.quantity;
            if (newQuantity < 0) {
              throw new BadRequestException('Insufficient stock');
            }
            newAvgCost = Number(inventory.avgCost);
            break;
          case 'ADJUSTMENT':
            newQuantity = dto.quantity;
            newAvgCost = dto.unitCost
              ? dto.unitCost
              : Number(inventory.avgCost);
            break;
          default:
            newQuantity = currentQty;
            newAvgCost = Number(inventory.avgCost);
        }

        // Update inventory
        inventory = await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantityOnHand: newQuantity,
            avgCost: newAvgCost,
          },
        });
      }

      // Create movement record
      const movement = await tx.inventoryMovement.create({
        data: {
          tenantId,
          shopId: dto.shopId,
          productId: dto.productId,
          variantId: dto.variantId || null,
          movementType: dto.type,
          quantity: dto.quantity,
          unitCost: dto.unitCost,
          referenceType: 'MANUAL_ADJUSTMENT',
          notes: dto.notes,
        },
      });

      return {
        inventory: {
          id: inventory.id,
          shopId: inventory.shopId,
          productId: inventory.productId,
          quantityOnHand: Number(inventory.quantityOnHand),
          avgCost: Number(inventory.avgCost),
        },
        movement: {
          id: movement.id,
          type: movement.movementType,
          quantity: Number(movement.quantity),
        },
      };
    });
  }

  async getMovements(
    query: InventoryMovementQueryDto,
    tenantId: string,
  ): Promise<IInventoryMovement[]> {
    const where: Prisma.InventoryMovementWhereInput = { tenantId };

    if (query.shopId) where.shopId = query.shopId;
    if (query.productId) where.productId = query.productId;

    if (query.startDate || query.endDate) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.startDate) createdAt.gte = new Date(query.startDate);
      if (query.endDate) createdAt.lte = new Date(query.endDate);
      where.createdAt = createdAt;
    }

    const movements = await this.databaseService.withTenant(
      tenantId,
      (prisma) =>
        prisma.inventoryMovement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
    );

    return movements.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      shopId: m.shopId,
      productId: m.productId,
      variantId: m.variantId,
      movementType: m.movementType,
      quantity: Number(m.quantity),
      unitCost: m.unitCost ? Number(m.unitCost) : null,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      notes: m.notes,
      createdAt: m.createdAt,
    }));
  }

  async checkAvailability(
    shopId: string,
    items: { productId: string; variantId?: string; quantity: number }[],
    tenantId: string,
  ): Promise<{ available: boolean; results: StockCheckResult[] }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const results: StockCheckResult[] = [];
      let allAvailable = true;

      for (const item of items) {
        const inventory = await prisma.inventory.findFirst({
          where: {
            shopId,
            productId: item.productId,
            variantId: item.variantId || null,
            product: { tenantId },
          },
        });

        const qtyOnHand = inventory ? Number(inventory.quantityOnHand) : 0;
        const qtyReserved = inventory
          ? Number(inventory.quantityReserved || 0)
          : 0;
        const available = qtyOnHand - qtyReserved;

        results.push({
          productId: item.productId,
          variantId: item.variantId,
          available,
          reserved: qtyReserved,
          quantityOnHand: qtyOnHand,
        });

        if (available < item.quantity) {
          allAvailable = false;
        }
      }

      return { available: allAvailable, results };
    });
  }

  async deductStock(
    shopId: string,
    items: {
      productId: string;
      variantId?: string;
      quantity: number;
      unitCost?: number;
    }[],
    referenceType: string,
    referenceId: string,
    tenantId: string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<void> {
    // externalTx keeps the deduction atomic with a caller's transaction (e.g. sale commit);
    // the RLS tenant GUC is already set on that connection.
    const run = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        // Get inventory
        const inventory = await tx.inventory.findFirst({
          where: {
            shopId,
            productId: item.productId,
            variantId: item.variantId || null,
            product: { tenantId },
          },
        });

        if (!inventory) {
          throw new BadRequestException(
            `No inventory found for product ${item.productId}`,
          );
        }

        const currentQty = Number(inventory.quantityOnHand);
        if (currentQty < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${item.productId}`,
          );
        }

        // Deduct stock
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantityOnHand: currentQty - item.quantity,
          },
        });

        // Record movement
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            shopId,
            productId: item.productId,
            variantId: item.variantId || null,
            movementType: 'OUT',
            quantity: item.quantity,
            unitCost: item.unitCost || Number(inventory.avgCost),
            referenceType,
            referenceId,
          },
        });
      }
    };

    if (externalTx) {
      await run(externalTx);
      return;
    }
    await this.databaseService.withTenant(tenantId, run);
  }

  /**
   * Mirrors `deductStock` for returns/refunds: puts the quantity back on the
   * shelf (same inventory-row lookup) and records `IN` movements. Unlike
   * `deductStock`, a missing inventory row is skipped with a warning instead
   * of throwing — the caller's refund journal excludes the same line's cost,
   * so the books and the physical stock stay consistent.
   */
  async restoreStock(
    shopId: string,
    items: {
      productId: string;
      variantId?: string | null;
      quantity: number;
    }[],
    referenceType: string,
    referenceId: string,
    tenantId: string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<void> {
    // externalTx keeps the restock atomic with a caller's transaction (e.g. a
    // sale refund); the RLS tenant GUC is already set on that connection.
    const run = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        const inventory = await tx.inventory.findFirst({
          where: {
            shopId,
            productId: item.productId,
            variantId: item.variantId || null,
            product: { tenantId },
          },
        });

        if (!inventory) {
          this.logger.warn(
            `No inventory record for product ${item.productId} in shop ${shopId}; refund restock skips this line`,
          );
          continue;
        }

        // Restock quantity-on-hand
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantityOnHand: Number(inventory.quantityOnHand) + item.quantity,
          },
        });

        // Record movement
        await tx.inventoryMovement.create({
          data: {
            tenantId,
            shopId,
            productId: item.productId,
            variantId: item.variantId || null,
            movementType: 'IN',
            quantity: item.quantity,
            unitCost: Number(inventory.avgCost),
            referenceType,
            referenceId,
          },
        });
      }
    };

    if (externalTx) {
      await run(externalTx);
      return;
    }
    await this.databaseService.withTenant(tenantId, run);
  }
}
