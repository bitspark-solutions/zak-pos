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

    it('should auto-generate SKU and create a primary barcode when sku omitted but barcode provided', async () => {
      // SKU generation loop -> findFirst returns null (candidate is free).
      mockPrisma.product.findFirst.mockResolvedValue(null);
      // Barcode tenant-wide pre-check -> no existing barcode.
      mockPrisma.barcode.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        ...sampleProduct,
        sku: 'rice-bag-ABC123',
        barcodes: [],
      });
      mockPrisma.barcode.create.mockResolvedValue({
        id: 'b-new',
        productId: 'p1',
        variantId: null,
        type: 'ean13',
        value: '8801111000015',
        isPrimary: true,
      });

      const result = await service.create(
        {
          name: 'Rice Bag',
          basePrice: 50,
          barcode: '8801111000015',
        },
        'tenant-1',
      );

      // Auto-generated SKU follows the import slug scheme, not the raw barcode.
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sku: expect.stringMatching(/^rice-bag-[0-9A-F]{6}$/),
          }),
        }),
      );
      expect(result.sku).not.toBe('8801111000015');
      expect(result.sku.startsWith('rice-bag-')).toBe(true);
      // The generated SKU was uniqueness-checked.
      expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', sku: expect.any(String) },
        select: { id: true },
      });
      // A primary barcode row was created with the length-inferred type.
      expect(mockPrisma.barcode.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          type: 'ean13',
          value: '8801111000015',
          isPrimary: true,
        },
      });
      expect(result.barcodes).toHaveLength(1);
      expect(result.barcodes?.[0].value).toBe('8801111000015');
    });

    it('should ignore non-digit barcode values (pure-digit filter)', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        ...sampleProduct,
        barcodes: [],
      });

      const result = await service.create(
        {
          name: 'Widget',
          basePrice: 20,
          barcodes: ['12ab34', 'ABC-9'],
        },
        'tenant-1',
      );

      expect(mockPrisma.barcode.create).not.toHaveBeenCalled();
      expect(result.barcodes).toHaveLength(0);
    });

    it('should throw ConflictException if the barcode already exists for this tenant', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.barcode.findFirst.mockResolvedValue({ id: 'b-existing' });

      await expect(
        service.create(
          {
            name: 'Duplicate Scan',
            sku: 'SKU-NEW',
            basePrice: 30,
            barcode: '8801111000015',
          },
          'tenant-1',
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.barcode.findFirst).toHaveBeenCalledWith({
        where: { value: '8801111000015', product: { tenantId: 'tenant-1' } },
      });
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('should remain backward-compatible for explicit sku with no barcode', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue(sampleProduct);

      const result = await service.create(
        {
          name: 'Plain Product',
          sku: 'SKU-001',
          basePrice: 100,
        },
        'tenant-1',
      );

      expect(result.sku).toBe('SKU-001');
      expect(mockPrisma.barcode.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.barcode.create).not.toHaveBeenCalled();
    });
  });

  describe('attachBarcode', () => {
    it('should attach a non-primary barcode to an existing product', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.barcode.findFirst.mockResolvedValue(null);
      mockPrisma.barcode.create.mockResolvedValue({
        id: 'b2',
        productId: 'p1',
        variantId: null,
        type: 'upc',
        value: '012345678901',
        isPrimary: false,
      });

      const result = await service.attachBarcode(
        'p1',
        '012345678901',
        'tenant-1',
      );

      expect(result).toEqual({
        id: 'b2',
        productId: 'p1',
        variantId: null,
        type: 'upc',
        value: '012345678901',
        isPrimary: false,
      });
      expect(mockPrisma.barcode.create).toHaveBeenCalledWith({
        data: {
          productId: 'p1',
          type: 'upc',
          value: '012345678901',
          isPrimary: false,
        },
      });
    });

    it('should throw BadRequestException for a non-digit barcode', async () => {
      await expect(
        service.attachBarcode('p1', 'abc-123', 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.barcode.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if the product does not exist', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.attachBarcode('p999', '123456789012', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if the barcode is already assigned', async () => {
      mockPrisma.product.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.barcode.findFirst.mockResolvedValue({ id: 'b-existing' });

      await expect(
        service.attachBarcode('p1', '123456789012', 'tenant-1'),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.barcode.create).not.toHaveBeenCalled();
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
