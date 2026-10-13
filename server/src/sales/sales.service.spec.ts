import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalesService } from './sales.service';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { TenantService } from '../auth/tenant.service';
import { ReceiptPdfService } from '../pdf/receipt-pdf.service';

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
      findMany: jest.fn(),
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
    restoreStock: jest.fn(),
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

  // Pure PDF renderer stand-in for the sale receipt endpoint.
  const mockReceiptPdfService = {
    render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 receipt-bytes')),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.withTenant.mockImplementation((tenantId, fn) =>
      fn(mockTx),
    );
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockTx });
    mockTenantService.seedAccounts.mockResolvedValue(accountsMap);
    mockInventoryService.deductStock.mockResolvedValue(undefined);
    mockInventoryService.restoreStock.mockResolvedValue(undefined);
    mockTx.journal.create.mockResolvedValue({ id: 'journal-1' });
    mockTx.journalLine.create.mockResolvedValue({});
    mockTx.saleLine.findMany.mockResolvedValue([]);
    mockReceiptPdfService.render.mockResolvedValue(
      Buffer.from('%PDF-1.4 receipt-bytes'),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: CartService, useValue: mockCartService },
        { provide: InventoryService, useValue: mockInventoryService },
        { provide: TenantService, useValue: mockTenantService },
        { provide: ReceiptPdfService, useValue: mockReceiptPdfService },
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

  describe('getSaleReceiptPdf', () => {
    const saleForPdf = {
      id: 'sale-1',
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      cashierId: 'user-1',
      status: 'completed',
      channel: 'pos',
      subtotal: 200,
      discount: 20,
      tax: 30,
      total: 210,
      paymentStatus: 'paid',
      currency: 'BDT',
      createdAt: new Date('2026-10-14T09:00:00Z'),
      postedAt: new Date('2026-10-14T09:05:00Z'),
      shop: { name: 'ZakPOS Demo', address: 'Dhaka' },
      customer: { name: 'Jane', phone: '01700' },
      saleLines: [
        {
          qty: 2,
          unitPrice: 100,
          lineTotal: 200,
          product: { name: 'Tea 500g' },
        },
      ],
      payments: [{ method: 'cash' }],
    };

    it('renders a tenant-scoped sale to non-empty PDF bytes', async () => {
      mockTx.sale.findFirst.mockResolvedValue(saleForPdf);

      const result = await service.getSaleReceiptPdf('sale-1', 'tenant-1');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.filename).toBe('sale-sale-1.pdf');
      expect(mockTx.sale.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('passes the normalized receipt payload to the PDF renderer', async () => {
      mockTx.sale.findFirst.mockResolvedValue(saleForPdf);

      await service.getSaleReceiptPdf('sale-1', 'tenant-1');

      expect(mockReceiptPdfService.render).toHaveBeenCalledWith(
        expect.objectContaining({
          shopName: 'ZakPOS Demo',
          documentNumber: 'sale-1',
          documentTitle: 'SALE RECEIPT',
          customerName: 'Jane',
          lines: [{ name: 'Tea 500g', qty: 2, unitPrice: 100, amount: 200 }],
          subtotal: 200,
          discount: 20,
          tax: 30,
          total: 210,
          paymentMethod: 'cash',
        }),
      );
    });

    it('throws NotFoundException for a cross-tenant / missing sale', async () => {
      mockTx.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.getSaleReceiptPdf('sale-x', 'tenant-2'),
      ).rejects.toThrow(NotFoundException);
      expect(mockReceiptPdfService.render).not.toHaveBeenCalled();
    });
  });

  describe('refund', () => {
    const mockRefundedSale = {
      id: 'sale-1',
      tenantId: 'tenant-1',
      shopId: 'shop-1',
      cashierId: 'user-1',
      status: 'completed',
      channel: 'pos',
      subtotal: 200,
      discount: 0,
      tax: 30,
      total: 230,
      paymentStatus: 'paid',
      currency: 'BDT',
      createdAt: new Date(),
      postedAt: new Date(),
    };

    // 2 units at 100 plus 30 VAT; weighted-average cost 40 per unit.
    const mockSaleLines = [
      {
        id: 'line-1',
        saleId: 'sale-1',
        productId: 'prod-1',
        variantId: null,
        qty: 2,
        unitPrice: 100,
        discount: 0,
        taxId: null,
        taxAmount: 30,
        lineTotal: 230,
      },
    ];

    const linesOfJournal = (journalId: string) =>
      mockTx.journalLine.create.mock.calls
        .map((call: any[]) => call[0].data)
        .filter((data: any) => data.journalId === journalId);

    const balanceOf = (journalId: string) => {
      const lines = linesOfJournal(journalId);
      return {
        debits: lines.reduce((sum: number, l: any) => sum + Number(l.debit), 0),
        credits: lines.reduce(
          (sum: number, l: any) => sum + Number(l.credit),
          0,
        ),
      };
    };

    const seedRefundMocks = () => {
      mockTx.sale.findFirst.mockResolvedValue(mockRefundedSale);
      mockTx.saleLine.findMany.mockResolvedValue(mockSaleLines);
      mockTx.inventory.findFirst.mockResolvedValue({ avgCost: 40 });
      mockTx.return.create.mockResolvedValue({ id: 'return-1' });
      mockTx.sale.update.mockResolvedValue({
        ...mockRefundedSale,
        status: 'refunded',
        paymentStatus: 'refunded',
      });
      mockTx.journal.create
        .mockResolvedValueOnce({ id: 'journal-refund' })
        .mockResolvedValueOnce({ id: 'journal-restock' });
      mockTx.journalLine.create.mockResolvedValue({});
    };

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

    it('should post a balanced revenue reversal and restock journal for a full refund', async () => {
      seedRefundMocks();

      const result = await service.refund(
        'sale-1',
        { refundMethod: 'cash', reason: 'damaged' },
        'tenant-1',
      );

      expect(result.status).toBe('refunded');
      // accounts resolved from the tenant chart of accounts inside the same tx
      expect(mockTenantService.seedAccounts).toHaveBeenCalledWith(
        mockTx,
        'tenant-1',
      );
      expect(mockTx.saleLine.findMany).toHaveBeenCalledWith({
        where: { saleId: 'sale-1' },
      });

      // revenue reversal journal mirrors the sale journal it reverses
      expect(mockTx.journal.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            description: 'Refund sale-1',
            source: 'REFUND',
            referenceType: 'sale',
            referenceId: 'sale-1',
            createdBy: 'user-1',
            status: 'posted',
          }),
        }),
      );
      expect(linesOfJournal('journal-refund')).toEqual([
        expect.objectContaining({
          accountId: 'acc-revenue',
          debit: 200,
          credit: 0,
          memo: 'Refund reason: damaged',
        }),
        expect.objectContaining({
          accountId: 'acc-vat',
          debit: 30,
          credit: 0,
        }),
        expect.objectContaining({
          accountId: 'acc-cash',
          debit: 0,
          credit: 230,
          memo: 'Refund method: cash',
        }),
      ]);
      expect(balanceOf('journal-refund')).toEqual({
        debits: 230,
        credits: 230,
      });

      // restock journal: Dr Inventory / Cr COGS at weighted-average cost
      expect(mockTx.journal.create).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            description: 'Restock for Refund sale-1',
            source: 'REFUND',
            referenceType: 'sale',
            referenceId: 'sale-1',
            createdBy: 'user-1',
            status: 'posted',
          }),
        }),
      );
      expect(linesOfJournal('journal-restock')).toEqual([
        expect.objectContaining({
          accountId: 'acc-inventory',
          debit: 80,
          credit: 0,
        }),
        expect.objectContaining({
          accountId: 'acc-cogs',
          debit: 0,
          credit: 80,
        }),
      ]);
      expect(balanceOf('journal-restock')).toEqual({ debits: 80, credits: 80 });

      // physical restock uses the same scope: full quantity back on the shelf,
      // inside the same tenant-scoped transaction
      expect(mockInventoryService.restoreStock).toHaveBeenCalledWith(
        'shop-1',
        [{ productId: 'prod-1', variantId: null, quantity: 2 }],
        'REFUND',
        'sale-1',
        'tenant-1',
        mockTx,
      );
    });

    it('should scale both journals proportionally for a partial refund', async () => {
      seedRefundMocks();

      await service.refund(
        'sale-1',
        {
          refundMethod: 'card',
          reason: 'one of two units',
          lines: [{ lineId: 'line-1', qty: 1 }],
        },
        'tenant-1',
      );

      expect(linesOfJournal('journal-refund')).toEqual([
        expect.objectContaining({ accountId: 'acc-revenue', debit: 100 }),
        expect.objectContaining({ accountId: 'acc-vat', debit: 15 }),
        expect.objectContaining({ accountId: 'acc-cash', credit: 115 }),
      ]);
      expect(balanceOf('journal-refund')).toEqual({
        debits: 115,
        credits: 115,
      });
      expect(linesOfJournal('journal-restock')).toEqual([
        expect.objectContaining({ accountId: 'acc-inventory', debit: 40 }),
        expect.objectContaining({ accountId: 'acc-cogs', credit: 40 }),
      ]);
      expect(balanceOf('journal-restock')).toEqual({ debits: 40, credits: 40 });

      // only the refunded quantity is restocked
      expect(mockInventoryService.restoreStock).toHaveBeenCalledWith(
        'shop-1',
        [{ productId: 'prod-1', variantId: null, quantity: 1 }],
        'REFUND',
        'sale-1',
        'tenant-1',
        mockTx,
      );
    });

    it('should skip the restock journal when nothing comes back to stock', async () => {
      mockTx.sale.findFirst.mockResolvedValue(mockRefundedSale);
      mockTx.saleLine.findMany.mockResolvedValue([]);
      mockTx.return.create.mockResolvedValue({ id: 'return-1' });
      mockTx.sale.update.mockResolvedValue({
        ...mockRefundedSale,
        status: 'refunded',
        paymentStatus: 'refunded',
      });

      await service.refund(
        'sale-1',
        { refundMethod: 'cash', reason: 'service failure' },
        'tenant-1',
      );

      expect(mockTx.journal.create).toHaveBeenCalledTimes(1);
      expect(mockTx.inventory.findFirst).not.toHaveBeenCalled();
      expect(mockInventoryService.restoreStock).toHaveBeenCalledWith(
        'shop-1',
        [],
        'REFUND',
        'sale-1',
        'tenant-1',
        mockTx,
      );
      expect(linesOfJournal('journal-1')).toEqual([
        expect.objectContaining({ accountId: 'acc-revenue', debit: 200 }),
        expect.objectContaining({ accountId: 'acc-vat', debit: 30 }),
        expect.objectContaining({ accountId: 'acc-cash', credit: 230 }),
      ]);
      expect(balanceOf('journal-1')).toEqual({ debits: 230, credits: 230 });
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
