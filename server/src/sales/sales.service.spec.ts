import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { TenantService } from '../auth/tenant.service';

describe('SalesService', () => {
  let service: SalesService;

  // Mock Prisma.TransactionClient handed to every withTenant callback.
  const mockTx = {
    sale: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    saleLine: {
      create: jest.fn(),
    },
    payment: {
      create: jest.fn(),
    },
    journal: {
      create: jest.fn(),
    },
    journalLine: {
      create: jest.fn(),
    },
    inventory: {
      findFirst: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    return: {
      create: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn(),
    withTenant: jest.fn((tenantId: string, fn: (tx: any) => any) => fn(mockTx)),
  };

  const mockCartService = {
    findByToken: jest.fn(),
    complete: jest.fn(),
  };

  const mockInventoryService = {
    deductStock: jest.fn(),
  };

  // seedAccounts returns a chart-of-accounts Map<code, id>.
  const accountsMap = new Map<string, string>([
    ['1000', 'acc-cash'],
    ['1500', 'acc-inventory'],
    ['2200', 'acc-vat'],
    ['4000', 'acc-revenue'],
    ['5000', 'acc-cogs'],
  ]);

  const mockTenantService = {
    seedAccounts: jest.fn().mockResolvedValue(accountsMap),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.withTenant.mockImplementation((tenantId, fn) =>
      fn(mockTx),
    );
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockTx });
    mockTenantService.seedAccounts.mockResolvedValue(accountsMap);
    mockInventoryService.deductStock.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: CartService, useValue: mockCartService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: TenantService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  describe('commitSale', () => {
    const mockCart = {
      id: 'cart-1',
      token: 'cart-token-1',
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      customerId: 'cust-1',
      cashierId: 'user-1',
      status: 'tendered',
      lines: [
        {
          id: 'line-1',
          productId: 'prod-1',
          variantId: 'var-1',
          qty: 2,
          unitPrice: 100,
          discount: 0,
          taxId: 'tax-1',
          taxAmount: 15,
          lineTotal: 215,
        },
      ],
      subtotal: 200,
      discount: 0,
      tax: 15,
      total: 215,
    };

    const mockSaleRow = {
      id: 'sale-1',
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      customerId: 'cust-1',
      cashierId: 'user-1',
      status: 'completed',
      channel: 'pos',
      subtotal: 200,
      discount: 0,
      tax: 15,
      total: 215,
      paymentStatus: 'paid',
      currency: 'BDT',
      createdAt: new Date(),
      postedAt: new Date(),
    };

    it('should successfully commit a valid tendered cart', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);
      mockTx.sale.create.mockResolvedValue(mockSaleRow);
      mockTx.saleLine.create.mockResolvedValue({
        id: 'sale-line-1',
        saleId: 'sale-1',
        ...mockCart.lines[0],
      });
      mockTx.payment.create.mockResolvedValue({});
      mockTx.journal.create.mockResolvedValue({ id: 'journal-1' });
      mockTx.journalLine.create.mockResolvedValue({});
      mockTx.inventory.findFirst.mockResolvedValue({ avgCost: 40 });
      mockCartService.complete.mockResolvedValue(undefined);

      const result = await service.commitSale(
        {
          cartToken: 'cart-token-1',
          paymentMethod: 'cash',
          amountTendered: 215,
        },
        'tenant-1',
      );

      expect(result.sale.id).toBe('sale-1');
      expect(result.lines).toHaveLength(1);
      expect(mockCartService.complete).toHaveBeenCalledWith(
        'cart-token-1',
        'tenant-1',
      );
    });

    it('should run the whole flow inside one tenant-scoped transaction', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);
      mockTx.sale.create.mockResolvedValue(mockSaleRow);
      mockTx.saleLine.create.mockResolvedValue({
        id: 'sale-line-1',
        saleId: 'sale-1',
        ...mockCart.lines[0],
      });
      mockTx.payment.create.mockResolvedValue({});
      mockTx.journal.create.mockResolvedValue({ id: 'journal-1' });
      mockTx.journalLine.create.mockResolvedValue({});
      mockTx.inventory.findFirst.mockResolvedValue({ avgCost: 40 });
      mockCartService.complete.mockResolvedValue(undefined);

      await service.commitSale(
        {
          cartToken: 'cart-token-1',
          paymentMethod: 'cash',
          amountTendered: 215,
        },
        'tenant-1',
      );

      // cart ownership verified for the tenant
      expect(mockCartService.findByToken).toHaveBeenCalledWith(
        'cart-token-1',
        'tenant-1',
      );

      // exactly one withTenant transaction for the commit flow
      expect(mockDatabaseService.withTenant).toHaveBeenCalledTimes(1);
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );

      // sale rows are written with the tenant id
      expect(mockTx.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId: 'tenant-1' }),
        }),
      );
      expect(mockTx.saleLine.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            saleId: 'sale-1',
          }),
        }),
      );

      // inventory deduction participates in the same transaction (tx passed as last arg)
      expect(mockInventoryService.deductStock).toHaveBeenCalledWith(
        'shop-1',
        [{ productId: 'prod-1', variantId: 'var-1', quantity: 2 }],
        'SALE',
        'sale-1',
        'tenant-1',
        mockTx,
      );

      // journal entries seeded against the tenant chart of accounts, inside the same tx
      expect(mockTenantService.seedAccounts).toHaveBeenCalledWith(
        mockTx,
        'tenant-1',
      );
      expect(mockTx.journal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            referenceId: 'sale-1',
          }),
        }),
      );
    });

    it('should throw BadRequestException if cart is not tendered', async () => {
      mockCartService.findByToken.mockResolvedValue({
        ...mockCart,
        status: 'active',
      });

      await expect(
        service.commitSale(
          { cartToken: 'cart-token-1', paymentMethod: 'cash' },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cart lines are empty', async () => {
      mockCartService.findByToken.mockResolvedValue({
        ...mockCart,
        status: 'tendered',
        lines: [],
      });

      await expect(
        service.commitSale(
          { cartToken: 'cart-token-1', paymentMethod: 'cash' },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tendered amount is less than total', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);

      await expect(
        service.commitSale(
          {
            cartToken: 'cart-token-1',
            paymentMethod: 'cash',
            amountTendered: 100,
          },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if inventory deduction fails', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);
      mockTx.sale.create.mockResolvedValue(mockSaleRow);
      mockTx.saleLine.create.mockResolvedValue({
        id: 'sale-line-1',
        saleId: 'sale-1',
        ...mockCart.lines[0],
      });
      mockInventoryService.deductStock.mockRejectedValue(
        new Error('Out of stock'),
      );

      await expect(
        service.commitSale(
          {
            cartToken: 'cart-token-1',
            paymentMethod: 'cash',
            amountTendered: 215,
          },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return sales matching tenant and shop query', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          tenantId: 'tenant-1',
          shopId: 'shop-1',
          cashierId: 'user-1',
          subtotal: 100,
          discount: 0,
          tax: 0,
          total: 100,
          status: 'completed',
          paymentStatus: 'paid',
          currency: 'BDT',
          createdAt: new Date(),
        },
      ];
      mockTx.sale.findMany.mockResolvedValue(mockSales);

      const result = await service.findAll('tenant-1', 'shop-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sale-1');
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockTx.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            shopId: 'shop-1',
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return sale by ID scoped to the tenant', async () => {
      mockTx.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        tenantId: 'tenant-1',
        shopId: 'shop-1',
        cashierId: 'user-1',
        subtotal: 100,
        discount: 0,
        tax: 0,
        total: 100,
        status: 'completed',
        paymentStatus: 'paid',
        currency: 'BDT',
        createdAt: new Date(),
        saleLines: [],
      });

      const result = await service.findById('sale-1', 'tenant-1');
      expect(result.id).toBe('sale-1');
      expect(mockTx.sale.findFirst).toHaveBeenCalledWith({
        where: { id: 'sale-1', tenantId: 'tenant-1' },
        include: { saleLines: true },
      });
    });

    it('should throw NotFoundException if sale does not exist', async () => {
      mockTx.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('non-existent', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdWithLines', () => {
    it('should return sale and its lines', async () => {
      mockTx.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        tenantId: 'tenant-1',
        shopId: 'shop-1',
        cashierId: 'user-1',
        subtotal: 100,
        discount: 0,
        tax: 0,
        total: 100,
        status: 'completed',
        paymentStatus: 'paid',
        currency: 'BDT',
        createdAt: new Date(),
        saleLines: [
          {
            id: 'line-1',
            saleId: 'sale-1',
            productId: 'prod-1',
            variantId: null,
            qty: 1,
            unitPrice: 100,
            discount: 0,
            taxId: null,
            taxAmount: 0,
            lineTotal: 100,
          },
        ],
      });

      const result = await service.findByIdWithLines('sale-1', 'tenant-1');
      expect(result.sale.id).toBe('sale-1');
      expect(result.lines).toHaveLength(1);
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
    });
  });

  describe('refund', () => {
    it('should refund a completed paid sale inside a tenant-scoped transaction', async () => {
      const mockSale = {
        id: 'sale-1',
        tenantId: 'tenant-1',
        shopId: 'shop-1',
        cashierId: 'user-1',
        subtotal: 100,
        discount: 0,
        tax: 0,
        total: 100,
        status: 'completed',
        paymentStatus: 'paid',
        currency: 'BDT',
        createdAt: new Date(),
      };
      mockTx.sale.findFirst.mockResolvedValue(mockSale);
      mockTx.return.create.mockResolvedValue({ id: 'return-1' });
      mockTx.sale.update.mockResolvedValue({
        ...mockSale,
        status: 'refunded',
        paymentStatus: 'refunded',
      });

      const result = await service.refund(
        'sale-1',
        { refundMethod: 'cash', reason: 'damaged' },
        'tenant-1',
      );

      expect(result.status).toBe('refunded');
      expect(result.paymentStatus).toBe('refunded');
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockTx.sale.findFirst).toHaveBeenCalledWith({
        where: { id: 'sale-1', tenantId: 'tenant-1' },
      });
      expect(mockTx.return.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if the sale belongs to another tenant', async () => {
      mockTx.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.refund(
          'sale-1',
          { refundMethod: 'cash', reason: 'test' },
          'tenant-2',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if sale is not completed', async () => {
      mockTx.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        tenantId: 'tenant-1',
        status: 'draft',
        paymentStatus: 'paid',
      });

      await expect(
        service.refund(
          'sale-1',
          { refundMethod: 'cash', reason: 'test' },
          'tenant-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
