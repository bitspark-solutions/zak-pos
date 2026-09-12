import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { DatabaseService } from '../database/database.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockPrisma = {
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
    $transaction: jest.fn(),
  };

  const mockTx = {
    inventory: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb) => await cb(mockTx));
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

      const result = await service.getStock({ shopId: 'shop-1' });
      expect(result).toHaveLength(1);
      expect(result[0].quantityOnHand).toBe(10);
      expect(result[0].product.name).toBe('Prod 1');
    });
  });

  describe('checkAvailability', () => {
    it('should return availability true when stock is sufficient', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 10,
      });

      const result = await service.checkAvailability('shop-1', [
        { productId: 'p1', quantity: 5 },
      ]);

      expect(result.available).toBe(true);
      expect(result.results[0].available).toBe(10);
      expect(result.results[0].quantityOnHand).toBe(10);
    });

    it('should return availability false when stock is insufficient', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 2,
      });

      const result = await service.checkAvailability('shop-1', [
        { productId: 'p1', quantity: 5 },
      ]);

      expect(result.available).toBe(false);
      expect(result.results[0].available).toBe(2);
      expect(result.results[0].quantityOnHand).toBe(2);
    });
  });

  describe('adjustStock', () => {
    it('should create new inventory record if not existing on IN movement', async () => {
      mockTx.inventory.findFirst.mockResolvedValue(null);
      mockTx.inventory.create.mockResolvedValue({
        id: 'inv-1',
        shopId: 'shop-1',
        productId: 'p1',
        variantId: null,
        quantityOnHand: 20,
        avgCost: 100,
        valuationMethod: 'WAVC',
        updatedAt: new Date(),
      });
      mockTx.inventoryMovement.create.mockResolvedValue({
        id: 'mov-1',
        quantity: 20,
        movementType: 'IN',
        createdAt: new Date(),
      });

      const result = await service.adjustStock({
        shopId: 'shop-1',
        productId: 'p1',
        quantity: 20,
        type: 'IN',
        unitCost: 100,
      });

      expect(result.inventory.quantityOnHand).toBe(20);
      expect(mockTx.inventory.create).toHaveBeenCalled();
      expect(mockTx.inventoryMovement.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException for non-existent inventory on OUT movement', async () => {
      mockTx.inventory.findFirst.mockResolvedValue(null);

      await expect(
        service.adjustStock({
          shopId: 'shop-1',
          productId: 'p1',
          quantity: 20,
          type: 'OUT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stock goes negative on OUT movement', async () => {
      mockTx.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 5,
        avgCost: 50,
      });

      await expect(
        service.adjustStock({
          shopId: 'shop-1',
          productId: 'p1',
          quantity: 10,
          type: 'OUT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should recalculate average cost on IN movement for existing inventory', async () => {
      mockTx.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 10,
        avgCost: 100,
      });
      mockTx.inventory.update.mockResolvedValue({
        id: 'inv-1',
        shopId: 'shop-1',
        productId: 'p1',
        variantId: null,
        quantityOnHand: 20,
        avgCost: 150,
        valuationMethod: 'WAVC',
        updatedAt: new Date(),
      });
      mockTx.inventoryMovement.create.mockResolvedValue({
        id: 'mov-1',
        quantity: 10,
        movementType: 'IN',
        createdAt: new Date(),
      });

      const result = await service.adjustStock({
        shopId: 'shop-1',
        productId: 'p1',
        quantity: 10,
        type: 'IN',
        unitCost: 200,
      });

      expect(mockTx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            quantityOnHand: 20,
            avgCost: 150,
          },
        }),
      );
    });
  });

  describe('deductStock', () => {
    it('should deduct stock successfully within transaction', async () => {
      mockTx.inventory.findFirst.mockResolvedValue({
        id: 'inv-1',
        quantityOnHand: 20,
        avgCost: 50,
      });
      mockTx.inventory.update.mockResolvedValue({});
      mockTx.inventoryMovement.create.mockResolvedValue({});

      await expect(
        service.deductStock(
          'shop-1',
          [{ productId: 'p1', quantity: 5 }],
          'SALE',
          'sale-1',
        ),
      ).resolves.not.toThrow();

      expect(mockTx.inventory.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            quantityOnHand: 15,
          },
        }),
      );
    });

    it('should throw BadRequestException if inventory record missing', async () => {
      mockTx.inventory.findFirst.mockResolvedValue(null);

      await expect(
        service.deductStock(
          'shop-1',
          [{ productId: 'p1', quantity: 5 }],
          'SALE',
          'sale-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if stock is insufficient', async () => {
      mockTx.inventory.findFirst.mockResolvedValue({
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
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
