import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';

describe('SalesService', () => {
  let service: SalesService;
  let cartService: CartService;
  let inventoryService: InventoryService;

  const mockPrisma = {
    $transaction: jest.fn((cb) => cb(mockTx)),
    sale: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    return: {
      create: jest.fn(),
    },
  };

  const mockTx = {
    sale: {
      create: jest.fn(),
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
    account: {
      findFirst: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
  };

  const mockCartService = {
    findByToken: jest.fn(),
    complete: jest.fn(),
  };

  const mockInventoryService = {
    deductStock: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (cb) => await cb(mockTx));
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: CartService, useValue: mockCartService },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    cartService = module.get<CartService>(CartService);
    inventoryService = module.get<InventoryService>(InventoryService);
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

    it('should successfully commit a valid tendered cart', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);
      mockTx.sale.create.mockResolvedValue({
        ...mockCart,
        id: 'sale-1',
        status: 'completed',
        channel: 'pos',
        paymentStatus: 'paid',
        currency: 'BDT',
        createdAt: new Date(),
        postedAt: new Date(),
      });
      mockTx.saleLine.create.mockResolvedValue({
        id: 'sale-line-1',
        saleId: 'sale-1',
        ...mockCart.lines[0],
      });
      mockInventoryService.deductStock.mockResolvedValue(undefined);
      mockTx.payment.create.mockResolvedValue({});
      mockTx.journal.create.mockResolvedValue({ id: 'journal-1' });
      mockTx.journalLine.create.mockResolvedValue({});
      mockTx.account.findFirst.mockResolvedValue({ id: 'account-1' });
      mockCartService.complete.mockResolvedValue(undefined);

      const result = await service.commitSale({
        cartToken: 'cart-token-1',
        paymentMethod: 'cash',
        amountTendered: 215,
      });

      expect(result.sale.id).toBe('sale-1');
      expect(result.lines).toHaveLength(1);
      expect(mockInventoryService.deductStock).toHaveBeenCalled();
      expect(mockCartService.complete).toHaveBeenCalledWith('cart-token-1');
    });

    it('should throw BadRequestException if cart is not tendered', async () => {
      mockCartService.findByToken.mockResolvedValue({
        ...mockCart,
        status: 'active',
      });

      await expect(
        service.commitSale({
          cartToken: 'cart-token-1',
          paymentMethod: 'cash',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cart lines are empty', async () => {
      mockCartService.findByToken.mockResolvedValue({
        ...mockCart,
        status: 'tendered',
        lines: [],
      });

      await expect(
        service.commitSale({
          cartToken: 'cart-token-1',
          paymentMethod: 'cash',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if tendered amount is less than total', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);

      await expect(
        service.commitSale({
          cartToken: 'cart-token-1',
          paymentMethod: 'cash',
          amountTendered: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if inventory deduction fails', async () => {
      mockCartService.findByToken.mockResolvedValue(mockCart);
      mockTx.sale.create.mockResolvedValue({
        id: 'sale-1',
        ...mockCart,
      });
      mockTx.saleLine.create.mockResolvedValue({
        id: 'sale-line-1',
        saleId: 'sale-1',
        ...mockCart.lines[0],
      });
      mockInventoryService.deductStock.mockRejectedValue(new Error('Out of stock'));

      await expect(
        service.commitSale({
          cartToken: 'cart-token-1',
          paymentMethod: 'cash',
          amountTendered: 215,
        }),
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
      mockPrisma.sale.findMany.mockResolvedValue(mockSales);

      const result = await service.findAll('tenant-1', 'shop-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sale-1');
    });
  });

  describe('findById', () => {
    it('should return sale by ID', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue({
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
      });

      const result = await service.findById('sale-1');
      expect(result.id).toBe('sale-1');
    });

    it('should throw NotFoundException if sale does not exist', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByIdWithLines', () => {
    it('should return sale and its lines', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue({
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
            qty: 1,
            unitPrice: 100,
            discount: 0,
            taxAmount: 0,
            lineTotal: 100,
          },
        ],
      });

      const result = await service.findByIdWithLines('sale-1');
      expect(result.sale.id).toBe('sale-1');
      expect(result.lines).toHaveLength(1);
    });
  });

  describe('refund', () => {
    it('should refund a completed paid sale', async () => {
      const mockSale = {
        id: 'sale-1',
        tenantId: 'tenant-1',
        cashierId: 'user-1',
        status: 'completed',
        paymentStatus: 'paid',
        subtotal: 100,
        tax: 0,
        total: 100,
      };
      mockPrisma.sale.findUnique.mockResolvedValue(mockSale);
      mockPrisma.return.create.mockResolvedValue({ id: 'return-1' });
      mockPrisma.sale.update.mockResolvedValue({
        ...mockSale,
        status: 'refunded',
        paymentStatus: 'refunded',
      });

      const result = await service.refund('sale-1', {
        refundMethod: 'cash',
      });

      expect(result.status).toBe('refunded');
      expect(result.paymentStatus).toBe('refunded');
      expect(mockPrisma.return.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if sale is not completed', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue({
        id: 'sale-1',
        status: 'draft',
        paymentStatus: 'paid',
      });

      await expect(
        service.refund('sale-1', { refundMethod: 'cash' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
