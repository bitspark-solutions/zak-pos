import { Test, TestingModule } from '@nestjs/testing';
import { CartService } from './cart.service';
import { DatabaseService } from '../database/database.service';
import { PricingService } from '../pricing/pricing.service';
import { ProductService } from '../product/product.service';
import { InventoryService } from '../inventory/inventory.service';

describe('CartService', () => {
  let service: CartService;
  let pricingService: PricingService;
  let productService: ProductService;
  let inventoryService: InventoryService;

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: PricingService, useValue: mockPricingService },
        { provide: ProductService, useValue: mockProductService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
    pricingService = module.get<PricingService>(PricingService);
    productService = module.get<ProductService>(ProductService);
    inventoryService = module.get<InventoryService>(InventoryService);

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clear carts after each test
    service.clearCarts();
  });

  describe('create', () => {
    it('should create a new cart with generated token', async () => {
      const dto = {
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      };

      const result = await service.create(dto);

      expect(result.token).toBeDefined();
      expect(result.shopId).toBe('shop-1');
      expect(result.cashierId).toBe('user-1');
      expect(result.tenantId).toBe('tenant-1');
      expect(result.status).toBe('active');
      expect(result.lines).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should use default tenant if not provided', async () => {
      const dto = {
        shopId: 'shop-1',
        cashierId: 'user-1',
      };

      const result = await service.create(dto);

      expect(result.tenantId).toBe('tenant-1');
    });
  });

  describe('findByToken', () => {
    it('should return cart when found', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      const result = await service.findByToken(cart.token);

      expect(result.id).toBe(cart.id);
      expect(result.token).toBe(cart.token);
    });

    it('should throw NotFoundException when cart not found', async () => {
      await expect(service.findByToken('nonexistent-token')).rejects.toThrow(
        'Cart not found',
      );
    });
  });

  describe('addLine', () => {
    it('should add a new line to cart', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      });

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

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: true,
        results: [{ productId: 'product-1', available: 100 }],
      });
      mockPricingService.calculateLinePrice.mockResolvedValue({
        lineTotal: 200,
        taxAmount: 0,
      });
      mockPricingService.calculatePrice.mockResolvedValue({
        subtotal: 200,
        discount: 0,
        tax: 0,
        total: 200,
        taxBreakdown: [],
      });

      const result = await service.addLine(cart.token, {
        productId: 'product-1',
        qty: 2,
      });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].productId).toBe('product-1');
      expect(result.lines[0].qty).toBe(2);
      expect(result.total).toBe(200);
    });

    it('should throw when product not found', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      mockProductService.findOne.mockResolvedValue(null);

      await expect(
        service.addLine(cart.token, {
          productId: 'nonexistent',
          qty: 1,
        }),
      ).rejects.toThrow('Product not found');
    });

    it('should throw when insufficient stock', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        sku: 'SKU001',
        basePrice: 100,
        taxId: null,
        tax: null,
      };

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: false,
        results: [{ productId: 'product-1', available: 0 }],
      });

      await expect(
        service.addLine(cart.token, {
          productId: 'product-1',
          qty: 10,
        }),
      ).rejects.toThrow('Insufficient stock');
    });

    it('should increment qty when adding same product', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      });

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

      mockProductService.findOne.mockResolvedValue(mockProduct);
      mockInventoryService.checkAvailability.mockResolvedValue({
        available: true,
        results: [{ productId: 'product-1', available: 100 }],
      });
      mockPricingService.calculateLinePrice.mockResolvedValue({
        lineTotal: 200,
        taxAmount: 0,
      });
      mockPricingService.calculatePrice.mockResolvedValue({
        subtotal: 200,
        discount: 0,
        tax: 0,
        total: 200,
        taxBreakdown: [],
      });

      await service.addLine(cart.token, { productId: 'product-1', qty: 1 });
      const result = await service.addLine(cart.token, { productId: 'product-1', qty: 2 });

      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].qty).toBe(3);
    });
  });

  describe('updateLine', () => {
    it('should update line quantity', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      });

      // Manually add a line to bypass checks
      (service as any).carts.get(cart.token).lines.push({
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

      mockPricingService.calculateLinePrice.mockResolvedValue({
        lineTotal: 300,
        taxAmount: 0,
      });
      mockPricingService.calculatePrice.mockResolvedValue({
        subtotal: 300,
        discount: 0,
        tax: 0,
        total: 300,
        taxBreakdown: [],
      });

      const result = await service.updateLine(cart.token, 'line-1', { qty: 3 });

      expect(result.lines[0].qty).toBe(3);
      expect(result.total).toBe(300);
    });

    it('should remove line when qty set to 0', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      });

      (service as any).carts.get(cart.token).lines.push({
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

      const result = await service.updateLine(cart.token, 'line-1', { qty: 0 });

      expect(result.lines).toHaveLength(0);
    });
  });

  describe('removeLine', () => {
    it('should remove line from cart', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      });

      (service as any).carts.get(cart.token).lines.push({
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

      const result = await service.removeLine(cart.token, 'line-1');

      expect(result.lines).toHaveLength(0);
    });
  });

  describe('tender', () => {
    it('should change cart status to tendered', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
        tenantId: 'tenant-1',
      });

      (service as any).carts.get(cart.token).lines.push({
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

      const result = await service.tender(cart.token);

      expect(result.status).toBe('tendered');
    });

    it('should throw for empty cart', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      await expect(service.tender(cart.token)).rejects.toThrow(
        'Cannot tender empty cart',
      );
    });
  });

  describe('cancel', () => {
    it('should cancel active cart', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      const result = await service.cancel(cart.token);

      expect(result.status).toBe('cancelled');
    });

    it('should not cancel completed cart', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      (service as any).carts.get(cart.token).status = 'completed';

      await expect(service.cancel(cart.token)).rejects.toThrow(
        'Cannot cancel completed cart',
      );
    });
  });

  describe('delete', () => {
    it('should delete cart', async () => {
      const cart = await service.create({
        shopId: 'shop-1',
        cashierId: 'user-1',
      });

      const result = await service.delete(cart.token);

      expect(result.success).toBe(true);
      await expect(service.findByToken(cart.token)).rejects.toThrow('Cart not found');
    });
  });
});
