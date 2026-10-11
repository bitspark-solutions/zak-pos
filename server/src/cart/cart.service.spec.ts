import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { DatabaseService } from '../database/database.service';
import { PricingService } from '../pricing/pricing.service';
import { ProductService } from '../product/product.service';
import { InventoryService } from '../inventory/inventory.service';
import { RedisService } from '../redis/redis.service';

describe('CartService', () => {
  let service: CartService;

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: {} }),
    isConnected: jest.fn().mockResolvedValue(true),
  };

  const mockPricingService = {
    calculateLinePrice: jest.fn(),
    calculatePrice: jest.fn(),
  };

  const mockProductService = {
    findOne: jest.fn(),
    findByBarcode: jest.fn(),
  };

  const mockInventoryService = {
    checkAvailability: jest.fn(),
  };

  // Fake Redis that serializes like the real service so date revival is exercised
  const store = new Map<string, string>();
  const mockRedisService = {
    getJson: jest.fn(async (key: string) =>
      store.has(key) ? JSON.parse(store.get(key)!) : null,
    ),
    setJson: jest.fn(async (key: string, value: unknown) => {
      store.set(key, JSON.stringify(value));
    }),
    ttl: jest.fn(async () => 3600),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    client: {},
  };

  const TENANT = 'tenant-1';
  const CASHIER = 'user-1';

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    sku: 'SKU001',
    basePrice: 100,
    taxId: null,
    tax: null,
    variants: [],
    barcodes: [],
  };

  async function mutateCart(token: string, mutator: (cart: any) => void): Promise<void> {
    const raw = JSON.parse(store.get(`cart:${token}`)!);
    mutator(raw);
    store.set(`cart:${token}`, JSON.stringify(raw));
  }

  function seedLine(token: string, line: Record<string, unknown>) {
    return mutateCart(token, (c) => c.lines.push(line));
  }

  function mockPricing(lineTotal: number, cartTotal: number) {
    mockPricingService.calculateLinePrice.mockResolvedValue({
      lineTotal,
      taxAmount: 0,
    });
    mockPricingService.calculatePrice.mockResolvedValue({
      subtotal: cartTotal,
      discount: 0,
      tax: 0,
      total: cartTotal,
      taxBreakdown: [],
    });
  }

  beforeEach(async () => {
    store.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: ProductService, useValue: mockProductService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  describe('create', () => {
    it('should create a new cart bound to the caller tenant and user', async () => {
      const result = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      expect(result.token).toBeDefined();
      expect(result.shopId).toBe('shop-1');
      expect(result.cashierId).toBe(CASHIER);
      expect(result.tenantId).toBe(TENANT);
      expect(result.status).toBe('active');
      expect(result.lines).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(store.has(`cart:${result.token}`)).toBe(true);
    });
  });

  describe('findByToken', () => {
    it('should return cart when found', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      const result = await service.findByToken(cart.token, TENANT);

      expect(result.id).toBe(cart.id);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw NotFoundException for another tenant', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await expect(service.findByToken(cart.token, 'tenant-2')).rejects.toThrow(
        'Cart not found',
      );
    });

    it('should throw NotFoundException when cart not found', async () => {
      await expect(service.findByToken('nonexistent-token', TENANT)).rejects.toThrow(
        'Cart not found',
      );
    });

    it('should throw and remove cart when expired', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);
      await mutateCart(cart.token, (c) => {
        c.expiresAt = new Date(Date.now() - 1000).toISOString();
      });

      await expect(service.findByToken(cart.token, TENANT)).rejects.toThrow(
        'Cart expired',
      );
      expect(store.has(`cart:${cart.token}`)).toBe(false);
    });
  });

  describe('addLine', () => {
    it('should add a new line to cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: true,
        results: [{ productId: 'product-1', available: 100 }],
      });
      mockPricing(200, 200);

      const result = await service.addLine(
        cart.token,
        { productId: 'product-1', qty: 2 },
        TENANT,
      );

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].qty).toBe(2);
      expect(result.total).toBe(200);
      expect(mockProductService.findOne).toHaveBeenCalledWith('product-1', TENANT);
    });

    it('should throw when product not found', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      mockProductService.findOne.mockResolvedValue(null);

      await expect(
        service.addLine(cart.token, { productId: 'nonexistent', qty: 1 }, TENANT),
      ).rejects.toThrow('Product not found');
    });

    it('should throw when insufficient stock', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: false,
        results: [{ productId: 'product-1', available: 0 }],
      });

      await expect(
        service.addLine(cart.token, { productId: 'product-1', qty: 10 }, TENANT),
      ).rejects.toThrow('Insufficient stock');
    });

    it('should increment qty when adding same product', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: true,
        results: [{ productId: 'product-1', available: 100 }],
      });
      mockPricing(200, 200);

      await service.addLine(cart.token, { productId: 'product-1', qty: 1 }, TENANT);
      const result = await service.addLine(cart.token, { productId: 'product-1', qty: 2 }, TENANT);

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].qty).toBe(3);
    });

    it('should persist changes across calls', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: true,
        results: [{ productId: 'product-1', available: 100 }],
      });
      mockPricing(200, 200);

      await service.addLine(cart.token, { productId: 'product-1', qty: 2 }, TENANT);
      const reloaded = await service.findByToken(cart.token, TENANT);

      expect(reloaded.lines).toHaveLength(1);
      expect(reloaded.total).toBe(200);
    });
  });

  describe('updateLine', () => {
    it('should update line quantity', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await seedLine(cart.token, {
        id: 'line-1',
        productId: 'product-1',
        productName: 'Test',
        sku: 'SKU',
        qty: 2,
        unitPrice: 100,
        discount: 0,
        taxAmount: 0,
        lineTotal: 200,
      });
      mockPricing(300, 300);

      const result = await service.updateLine(cart.token, 'line-1', { qty: 3 }, TENANT);

      expect(result.lines[0].qty).toBe(3);
      expect(result.total).toBe(300);
    });

    it('should remove line when qty set to 0', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await seedLine(cart.token, {
        id: 'line-1',
        productId: 'product-1',
        productName: 'Test',
        sku: 'SKU',
        qty: 2,
        unitPrice: 100,
        discount: 0,
        taxAmount: 0,
        lineTotal: 200,
      });
      mockPricingService.calculatePrice.mockResolvedValue({
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
        taxBreakdown: [],
      });

      const result = await service.updateLine(cart.token, 'line-1', { qty: 0 }, TENANT);

      expect(result.lines).toHaveLength(0);
    });
  });

  describe('removeLine', () => {
    it('should remove line from cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await seedLine(cart.token, {
        id: 'line-1',
        productId: 'product-1',
        productName: 'Test',
        sku: 'SKU',
        qty: 2,
        unitPrice: 100,
        discount: 0,
        taxAmount: 0,
        lineTotal: 200,
      });
      mockPricingService.calculatePrice.mockResolvedValue({
        subtotal: 0,
        discount: 0,
        tax: 0,
        total: 0,
        taxBreakdown: [],
      });

      const result = await service.removeLine(cart.token, 'line-1', TENANT);

      expect(result.lines).toHaveLength(0);
    });
  });

  describe('tender', () => {
    it('should change cart status to tendered', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await seedLine(cart.token, {
        id: 'line-1',
        productId: 'product-1',
        productName: 'Test',
        sku: 'SKU',
        qty: 1,
        unitPrice: 100,
        discount: 0,
        taxAmount: 0,
        lineTotal: 100,
      });

      const result = await service.tender(cart.token, TENANT);

      expect(result.status).toBe('tendered');

      const reloaded = await service.findByToken(cart.token, TENANT);
      expect(reloaded.status).toBe('tendered');
    });

    it('should throw for empty cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await expect(service.tender(cart.token, TENANT)).rejects.toThrow(
        'Cannot tender empty cart',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel active cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      const result = await service.cancel(cart.token, TENANT);

      expect(result.status).toBe('cancelled');
    });

    it('should not cancel completed cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await mutateCart(cart.token, (c) => {
        c.status = 'completed';
      });

      await expect(service.cancel(cart.token, TENANT)).rejects.toThrow(
        'Cannot cancel completed cart',
      );
    });
  });

  describe('delete', () => {
    it('should delete cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      const result = await service.delete(cart.token, TENANT);

      expect(result.success).toBe(true);
      await expect(service.findByToken(cart.token, TENANT)).rejects.toThrow('Cart not found');
    });

    it('should not delete another tenant cart', async () => {
      const cart = await service.create({ shopId: 'shop-1' }, TENANT, CASHIER);

      await expect(service.delete(cart.token, 'tenant-2')).rejects.toThrow('Cart not found');
    });
  });
});
