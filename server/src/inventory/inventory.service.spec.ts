import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { DatabaseService } from '../database/database.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockPrisma = {
    product: {
      findFirst: jest.fn(),
    },
    inventory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('getStock', () => {
    it('should query and return inventory list', async () => {
      mockPrisma.inventory.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          shopId: 'shop-1',
          productId: 'p1',
          variantId: null,
          quantityOnHand: 10,
          valuationMethod: 'WAVC',
          avgCost: 50,
          updatedAt: new Date(),
          product: { id: 'p1', name: 'Prod 1', sku: 'SKU1', unit: 'pcs' },
          variant: null,
        },
      ]);

      const result = await service.getStock({ shopId: 'shop-1' }, 'tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].quantityOnHand).toBe(10);
      expect(result[0].product.name).toBe('Prod 1');
      expect(mockPrisma.inventory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { product: { tenantId: 'tenant-1' }, shopId: 'shop-1' },
        }),
      );
    });
  });

  describe('checkAvailability', () => {
    it('should return availability true when stock is sufficient', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 10,
      });

      const result = await service.checkAvailability(
        'shop-1',
        [{ productId: 'p1', quantity: 5 }],
        'tenant-1',
      );

      expect(result.available).toBe(true);
      expect(result.results[0].available).toBe(10);
      expect(result.results[0].quantityOnHand).toBe(10);
      expect(mockPrisma.inventory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId: 'shop-1',
            productId: 'p1',
            product: { tenantId: 'tenant-1' },
          }),
        }),
      );
    });

    it('should return availability false when stock is insufficient', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 2,
      });

      const result = await service.checkAvailability(
        'shop-1',
        [{ productId: 'p1', quantity: 5 }],
        'tenant-1',
      );

      expect(result.available).toBe(false);
      expect(result.results[0].available).toBe(2);
      expect(result.results[0].quantityOnHand).toBe(2);
    });
  });

  describe('adjustStock', () => {
    it('should create new inventory record if not existing on IN movement', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        tenantId: 'tenant-1',
      });
      mockPrisma.inventory.findFirst.mockResolvedValue(null);
      mockPrisma.inventory.create.mockResolvedValue({
        id: 'inv-1',
        shopId: 'shop-1',
        productId: 'p1',
        variantId: null,
        quantityOnHand: 20,
        avgCost: 100,
        valuationMethod: 'WAVC',
        updatedAt: new Date(),
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({
        id: 'mov-1',
        quantity: 20,
        movementType: 'IN',
        createdAt: new Date(),
      });

      const result = await service.adjustStock(
        {
          shopId: 'shop-1',
          productId: 'p1',
          quantity: 20,
          type: 'IN',
          unitCost: 100,
        },
        'tenant-1',
      );

      expect(result.inventory.quantityOnHand).toBe(20);
      expect(mockPrisma.inventory.create).toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            movementType: 'IN',
          }),
        }),
      );
    });

    it('should throw BadRequestException for non-existent inventory on OUT movement', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        tenantId: 'tenant-1',
      });
      mockPrisma.inventory.findFirst.mockResolvedValue(null);

      await expect(
        service.adjustStock(
          {
            shopId: 'shop-1',
            productId: 'p1',
            quantity: 20,
            type: 'OUT',
          },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stock goes negative on OUT movement', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        tenantId: 'tenant-1',
      });
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 5,
        avgCost: 50,
      });

      await expect(
        service.adjustStock(
          {
            shopId: 'shop-1',
            productId: 'p1',
            quantity: 10,
            type: 'OUT',
          },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate average cost on IN movement for existing inventory', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({
        id: 'p1',
        tenantId: 'tenant-1',
      });
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 10,
        avgCost: 100,
      });
      mockPrisma.inventory.update.mockResolvedValue({
        id: 'inv-1',
        shopId: 'shop-1',
        productId: 'p1',
        variantId: null,
        quantityOnHand: 20,
        avgCost: 150,
        valuationMethod: 'WAVC',
        updatedAt: new Date(),
      });
      mockPrisma.inventoryMovement.create.mockResolvedValue({
        id: 'mov-1',
        quantity: 10,
        movementType: 'IN',
        createdAt: new Date(),
      });

      const result = await service.adjustStock(
        {
          shopId: 'shop-1',
          productId: 'p1',
          quantity: 10,
          type: 'IN',
          unitCost: 200,
        },
        'tenant-1',
      );

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            quantityOnHand: 20,
            avgCost: 150,
          },
        }),
      );
      expect(result.inventory.quantityOnHand).toBe(20);
    });
  });

  describe('deductStock', () => {
    it('should deduct stock successfully within transaction', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 20,
        avgCost: 50,
      });
      mockPrisma.inventory.update.mockResolvedValue({});
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await expect(
        service.deductStock(
          'shop-1',
          [{ productId: 'p1', quantity: 5 }],
          'SALE',
          'sale-1',
          'tenant-1',
        ),
      ).resolves.not.toThrow();

      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            quantityOnHand: 15,
          },
        }),
      );
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            movementType: 'OUT',
            referenceId: 'sale-1',
          }),
        }),
      );
    });

    it('should throw BadRequestException if inventory record missing', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue(null);

      await expect(
        service.deductStock(
          'shop-1',
          [{ productId: 'p1', quantity: 5 }],
          'SALE',
          'sale-1',
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 2,
        avgCost: 50,
      });

      await expect(
        service.deductStock(
          'shop-1',
          [{ productId: 'p1', quantity: 5 }],
          'SALE',
          'sale-1',
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('restoreStock', () => {
    it('should increase quantity-on-hand and record an IN movement', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 3,
        avgCost: 50,
      });
      mockPrisma.inventory.update.mockResolvedValue({});
      mockPrisma.inventoryMovement.create.mockResolvedValue({});

      await service.restoreStock(
        'shop-1',
        [{ productId: 'p1', variantId: 'var-1', quantity: 2 }],
        'REFUND',
        'sale-1',
        'tenant-1',
      );

      expect(mockPrisma.inventory.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId: 'shop-1',
            productId: 'p1',
            variantId: 'var-1',
            product: { tenantId: 'tenant-1' },
          }),
        }),
      );
      expect(mockPrisma.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { quantityOnHand: 5 },
        }),
      );
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            shopId: 'shop-1',
            productId: 'p1',
            variantId: 'var-1',
            movementType: 'IN',
            quantity: 2,
            unitCost: 50,
            referenceType: 'REFUND',
            referenceId: 'sale-1',
          }),
        }),
      );
    });

    it('should skip items whose inventory row is missing instead of throwing', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue(null);

      await expect(
        service.restoreStock(
          'shop-1',
          [{ productId: 'p1', quantity: 5 }],
          'REFUND',
          'sale-1',
          'tenant-1',
        ),
      ).resolves.not.toThrow();

      expect(mockPrisma.inventory.update).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('should reuse an external transaction without opening a new one', async () => {
      const findFirst = jest.fn().mockResolvedValue({
        id: 'inv-9',
        quantityOnHand: 0,
        avgCost: 20,
      });
      const update = jest.fn().mockResolvedValue({});
      const createMovement = jest.fn().mockResolvedValue({});
      const externalTx = {
        inventory: { findFirst, update },
        inventoryMovement: { create: createMovement },
      } as unknown as Prisma.TransactionClient;

      await service.restoreStock(
        'shop-1',
        [{ productId: 'p1', variantId: null, quantity: 4 }],
        'REFUND',
        'sale-1',
        'tenant-1',
        externalTx,
      );

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ variantId: null }),
        }),
      );
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantityOnHand: 4 } }),
      );
      expect(createMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            movementType: 'IN',
            quantity: 4,
            referenceType: 'REFUND',
          }),
        }),
      );
      // no extra tenant transaction opened
      expect(mockDatabaseService.withTenant).not.toHaveBeenCalled();
    });
  });
});
