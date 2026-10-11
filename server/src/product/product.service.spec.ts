import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { DatabaseService } from '../database/database.service';

describe('ProductService', () => {
  let service: ProductService;

  const mockPrisma = {
    product: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    barcode: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    productVariant: {
      create: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    tax: {
      findFirst: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  const sampleProduct = {
    id: 'p1',
    tenantId: 'tenant-1',
    name: 'Test Product',
    sku: 'SKU-001',
    unit: 'pcs',
    basePrice: 100,
    defaultCost: 60,
    categoryId: 'c1',
    taxId: 't1',
    isWeighted: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: 'c1', name: 'Cat 1' },
    tax: { id: 't1', name: 'VAT', ratePercent: 15 },
    variants: [],
    barcodes: [
      { id: 'b1', value: '123456789', type: 'ean13', isPrimary: true },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('create', () => {
    it('should create a product if SKU is unique', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(sampleProduct);

      const result = await service.create(
        {
          name: 'Test Product',
          sku: 'SKU-001',
          basePrice: 100,
          unit: 'pcs',
        },
        'tenant-1',
      );

      expect(result.id).toBe('p1');
      expect(result.sku).toBe('SKU-001');
      expect(result.basePrice).toBe(100);
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', sku: 'SKU-001' },
      });
    });

    it('should throw ConflictException if SKU already exists', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(sampleProduct);

      await expect(
        service.create(
          {
            name: 'Another Product',
            sku: 'SKU-001',
            basePrice: 120,
          },
          'tenant-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('should validate category and tax tenant refs when provided', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.category.findFirst.mockResolvedValue({
        id: 'c1',
        tenantId: 'tenant-1',
      });
      mockPrisma.tax.findFirst.mockResolvedValue({
        id: 't1',
        tenantId: 'tenant-1',
      });
      mockPrisma.product.create.mockResolvedValue(sampleProduct);

      const result = await service.create(
        {
          name: 'Test Product',
          sku: 'SKU-001',
          basePrice: 100,
          categoryId: 'c1',
          taxId: 't1',
        },
        'tenant-1',
      );

      expect(result.id).toBe('p1');
      expect(mockPrisma.category.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', tenantId: 'tenant-1' },
      });
      expect(mockPrisma.tax.findFirst).toHaveBeenCalledWith({
        where: { id: 't1', tenantId: 'tenant-1' },
      });
    });

    it('should throw BadRequestException if category does not belong to tenant', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            name: 'Test Product',
            sku: 'SKU-001',
            basePrice: 100,
            categoryId: 'c-x',
          },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated products list', async () => {
      mockPrisma.product.findMany.mockResolvedValue([sampleProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 10, search: 'Test' },
        'tenant-1',
      );

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
      expect(mockPrisma.product.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return product by id', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(sampleProduct);
      const result = await service.findOne('p1', 'tenant-1');
      expect(result.id).toBe('p1');
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'p1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('should throw NotFoundException if product not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(service.findOne('p999', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByBarcode', () => {
    it('should find product by barcode', async () => {
      mockPrisma.barcode.findFirst.mockResolvedValue({
        product: sampleProduct,
        variant: null,
      });

      const result = await service.findByBarcode('123456789', 'tenant-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('p1');
      expect(mockPrisma.barcode.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { value: '123456789', product: { tenantId: 'tenant-1' } },
        }),
      );
    });

    it('should return null if barcode not found', async () => {
      mockPrisma.barcode.findFirst.mockResolvedValue(null);
      const result = await service.findByBarcode('999999', 'tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update product successfully', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(sampleProduct);
      mockPrisma.product.update.mockResolvedValue({
        ...sampleProduct,
        name: 'Updated Name',
      });

      const result = await service.update(
        'p1',
        { name: 'Updated Name' },
        'tenant-1',
      );
      expect(result.name).toBe('Updated Name');
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', tenantId: 'tenant-1' },
      });
    });

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.update('p999', { name: 'New' }, 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete product successfully', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(sampleProduct);
      mockPrisma.product.update.mockResolvedValue({
        ...sampleProduct,
        isActive: false,
      });

      const result = await service.remove('p1', 'tenant-1');
      expect(result).toEqual({ success: true });
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isActive: false },
      });
    });
  });
});
