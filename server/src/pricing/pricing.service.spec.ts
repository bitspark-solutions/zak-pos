import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { DatabaseService } from '../database/database.service';

describe('PricingService', () => {
  let service: PricingService;
  let databaseService: DatabaseService;

  const mockPrisma = {
    tax: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mockDatabaseService = {
      getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        {
          provide: DatabaseService,
          useValue: mockDatabaseService,
        },
      ],
    }).compile();

    service = module.get<PricingService>(PricingService);
    databaseService = module.get<DatabaseService>(DatabaseService);

    jest.clearAllMocks();
  });

  describe('calculateLinePrice', () => {
    it('should calculate line total without tax', async () => {
      const result = await service.calculateLinePrice(100, 2, 0, undefined);

      expect(result).toEqual({
        lineTotal: 200,
        taxAmount: 0,
      });
    });

    it('should calculate line total with discount', async () => {
      const result = await service.calculateLinePrice(100, 2, 20, undefined);

      expect(result).toEqual({
        lineTotal: 180,
        taxAmount: 0,
      });
    });

    it('should calculate exclusive tax correctly', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue({
        id: 'tax-1',
        name: 'VAT',
        ratePercent: 15,
        inclusive: false,
      });

      const result = await service.calculateLinePrice(100, 1, 0, 'tax-1');

      expect(result.lineTotal).toBe(115);
      expect(result.taxAmount).toBe(15);
    });

    it('should calculate inclusive tax correctly', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue({
        id: 'tax-1',
        name: 'VAT',
        ratePercent: 15,
        inclusive: true,
      });

      const result = await service.calculateLinePrice(115, 1, 0, 'tax-1');

      // With 15% inclusive tax, base = 115/1.15 = 100, tax = 15
      expect(result.taxAmount).toBeCloseTo(15, 2);
      expect(result.lineTotal).toBe(115);
    });

    it('should return zero when tax not found', async () => {
      mockPrisma.tax.findUnique.mockResolvedValue(null);

      const result = await service.calculateLinePrice(100, 1, 0, 'nonexistent-tax');

      expect(result).toEqual({
        lineTotal: 100,
        taxAmount: 0,
      });
    });
  });

  describe('calculatePrice', () => {
    it('should calculate totals for multiple lines without tax', async () => {
      const lines = [
        {
          productId: 'p1',
          productName: 'Product 1',
          sku: 'SKU1',
          qty: 2,
          unitPrice: 100,
          discount: 0,
          taxAmount: 0,
          lineTotal: 200,
        },
        {
          productId: 'p2',
          productName: 'Product 2',
          sku: 'SKU2',
          qty: 1,
          unitPrice: 50,
          discount: 0,
          taxAmount: 0,
          lineTotal: 50,
        },
      ];

      mockPrisma.tax.findMany.mockResolvedValue([]);

      const result = await service.calculatePrice(lines, 'tenant-1');

      expect(result.subtotal).toBe(250);
      expect(result.discount).toBe(0);
      expect(result.tax).toBe(0);
      expect(result.total).toBe(250);
    });

    it('should apply discounts correctly', async () => {
      const lines = [
        {
          productId: 'p1',
          productName: 'Product 1',
          sku: 'SKU1',
          qty: 1,
          unitPrice: 100,
          discount: 10,
          taxAmount: 0,
          lineTotal: 90,
        },
      ];

      mockPrisma.tax.findMany.mockResolvedValue([]);

      const result = await service.calculatePrice(lines, 'tenant-1');

      expect(result.subtotal).toBe(100);
      expect(result.discount).toBe(10);
      expect(result.total).toBe(90);
    });

    it('should calculate exclusive tax for multiple lines', async () => {
      const lines = [
        {
          productId: 'p1',
          productName: 'Product 1',
          sku: 'SKU1',
          qty: 1,
          unitPrice: 100,
          discount: 0,
          taxId: 'tax-1',
          taxAmount: 0,
          lineTotal: 100,
        },
        {
          productId: 'p2',
          productName: 'Product 2',
          sku: 'SKU2',
          qty: 1,
          unitPrice: 100,
          discount: 0,
          taxId: 'tax-1',
          taxAmount: 0,
          lineTotal: 100,
        },
      ];

      mockPrisma.tax.findMany.mockResolvedValue([
        {
          id: 'tax-1',
          tenantId: 'tenant-1',
          name: 'VAT',
          ratePercent: 15,
          inclusive: false,
          isActive: true,
        },
      ]);

      const result = await service.calculatePrice(lines, 'tenant-1');

      expect(result.subtotal).toBe(200);
      expect(result.tax).toBe(30);
      expect(result.total).toBe(230);
      expect(result.taxBreakdown).toHaveLength(1);
      expect(result.taxBreakdown[0].taxAmount).toBe(30);
    });
  });
});
