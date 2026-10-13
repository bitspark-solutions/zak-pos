import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { DatabaseService } from '../database/database.service';
import { ReceiptPdfService } from '../pdf/receipt-pdf.service';

describe('InvoiceService', () => {
  let service: InvoiceService;

  const mockPrisma = {
    invoice: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    sale: {
      findFirst: jest.fn(),
    },
    // G2a auto-share reads (tenant-scoped tx client)
    customer: {
      findFirst: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
    },
    customerFollow: {
      findUnique: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  // Pure PDF renderer stand-in: the specs assert it is called with the
  // normalized payload and return non-empty placeholder bytes.
  const mockReceiptPdfService = {
    render: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake-bytes')),
  };

  const sampleInvoice = {
    id: 'inv-1',
    invoiceNumber: 'INV-20260913-0001',
    tenantId: 'tenant-1',
    shopId: 'shop-1',
    saleId: 'sale-1',
    customerId: 'cust-1',
    status: 'draft',
    subtotal: 100,
    tax: 15,
    discount: 0,
    total: 115,
    dueDate: null,
    notes: 'Test note',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });
    mockDatabaseService.withTenant.mockImplementation(
      (tenantId: string, fn: any) => fn(mockPrisma),
    );
    mockReceiptPdfService.render.mockResolvedValue(
      Buffer.from('%PDF-1.4 fake-bytes'),
    );
    // Auto-share defaults to "skip": no linked account rows unless a test stubs them.
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    mockPrisma.customerAccount.findUnique.mockResolvedValue(null);
    mockPrisma.customerFollow.findUnique.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ReceiptPdfService, useValue: mockReceiptPdfService },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  describe('create', () => {
    it('should create an invoice linking sale data if saleId provided', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        subtotal: 100,
        tax: 15,
        discount: 0,
        total: 115,
      });
      mockPrisma.invoice.create.mockResolvedValue(sampleInvoice);

      const result = await service.create(
        {
          shopId: 'shop-1',
          saleId: 'sale-1',
          customerId: 'cust-1',
        },
        'user-1',
        'tenant-1',
      );

      expect(result.id).toBe('inv-1');
      expect(result.invoiceNumber).toBe('INV-20260913-0001');
      expect(result.total).toBe(115);
      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockPrisma.sale.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sale-1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('should throw NotFoundException if linked sale is not found', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            shopId: 'shop-1',
            saleId: 'non-existent',
          },
          'user-1',
          'tenant-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createFromSale', () => {
    const createdInvoice = { ...sampleInvoice, saleId: 'sale-1' };

    it('creates an invoice from the sale and reports created=true', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null); // no existing invoice
      mockPrisma.sale.findFirst.mockResolvedValue({
        id: 'sale-1',
        tenantId: 'tenant-1',
        shopId: 'shop-1',
        customerId: 'cust-1',
        subtotal: 100,
        tax: 15,
        discount: 0,
        total: 115,
      });
      mockPrisma.invoice.create.mockResolvedValue(createdInvoice);

      const result = await service.createFromSale(
        'sale-1',
        'user-1',
        'tenant-1',
      );

      expect(result.created).toBe(true);
      expect(result.invoice.id).toBe('inv-1');
      expect(mockPrisma.sale.findFirst).toHaveBeenCalledWith({
        where: { id: 'sale-1', tenantId: 'tenant-1' },
      });
      expect(mockPrisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            shopId: 'shop-1',
            saleId: 'sale-1',
            total: 115,
            status: 'draft',
          }),
        }),
      );
    });

    it('is idempotent: returns the existing invoice without creating one', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(createdInvoice);

      const result = await service.createFromSale(
        'sale-1',
        'user-1',
        'tenant-1',
      );

      expect(result.created).toBe(false);
      expect(result.invoice.id).toBe('inv-1');
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
      expect(mockPrisma.sale.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the sale is not in the tenant', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      mockPrisma.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.createFromSale('sale-x', 'user-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    describe('G2a auto-share', () => {
      const saleWithCustomer = {
        id: 'sale-1',
        tenantId: 'tenant-1',
        shopId: 'shop-1',
        customerId: 'cust-1',
        subtotal: 100,
        tax: 15,
        discount: 0,
        total: 115,
      };

      beforeEach(() => {
        mockPrisma.invoice.findFirst.mockResolvedValue(null);
        mockPrisma.sale.findFirst.mockResolvedValue(saleWithCustomer);
        mockPrisma.invoice.create.mockResolvedValue({
          ...sampleInvoice,
          saleId: 'sale-1',
          sharedAt: null,
        });
      });

      it('sets sharedAt when the contact links a phone-verified, following account', async () => {
        mockPrisma.customer.findFirst.mockResolvedValue({ accountId: 'acc-1' });
        mockPrisma.customerAccount.findUnique.mockResolvedValue({
          phoneVerifiedAt: new Date('2026-10-01'),
        });
        mockPrisma.customerFollow.findUnique.mockResolvedValue({
          active: true,
        });
        mockPrisma.invoice.update.mockResolvedValue(sampleInvoice);

        const result = await service.createFromSale(
          'sale-1',
          'user-1',
          'tenant-1',
        );

        expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 'inv-1' },
            data: expect.objectContaining({ sharedAt: expect.any(Date) }),
          }),
        );
        expect(result.invoice.sharedAt).toBeInstanceOf(Date);
      });

      it('skips sharing when the account phone is not verified', async () => {
        mockPrisma.customer.findFirst.mockResolvedValue({ accountId: 'acc-1' });
        mockPrisma.customerAccount.findUnique.mockResolvedValue({
          phoneVerifiedAt: null,
        });

        const result = await service.createFromSale(
          'sale-1',
          'user-1',
          'tenant-1',
        );

        expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
        expect(result.invoice.sharedAt).toBeNull();
      });

      it('skips sharing when there is no active follow (and never throws)', async () => {
        mockPrisma.customer.findFirst.mockResolvedValue({ accountId: 'acc-1' });
        mockPrisma.customerAccount.findUnique.mockResolvedValue({
          phoneVerifiedAt: new Date('2026-10-01'),
        });
        mockPrisma.customerFollow.findUnique.mockResolvedValue({
          active: false,
        });

        const result = await service.createFromSale(
          'sale-1',
          'user-1',
          'tenant-1',
        );

        expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
        expect(result.created).toBe(true);
      });

      it('skips silently for an unlinked (walk-in) contact', async () => {
        mockPrisma.customer.findFirst.mockResolvedValue({ accountId: null });

        await service.createFromSale('sale-1', 'user-1', 'tenant-1');

        expect(mockPrisma.customerAccount.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('generateInvoicePdf', () => {
    const invoiceForPdf = {
      ...sampleInvoice,
      notes: null,
      shop: { name: 'ZakPOS Demo', address: 'Dhaka' },
      customer: { name: 'Jane', phone: '01700' },
      sale: {
        currency: 'BDT',
        saleLines: [
          {
            qty: 2,
            unitPrice: 50,
            lineTotal: 100,
            product: { name: 'Tea' },
          },
        ],
        payments: [{ method: 'cash' }],
      },
    };

    it('renders an in-tenant invoice to non-empty PDF bytes', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(invoiceForPdf);

      const result = await service.generateInvoicePdf('inv-1', 'tenant-1');

      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.filename).toBe('INV-20260913-0001.pdf');
    });

    it('passes the normalized receipt payload to the PDF renderer', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(invoiceForPdf);

      await service.generateInvoicePdf('inv-1', 'tenant-1');

      expect(mockReceiptPdfService.render).toHaveBeenCalledWith(
        expect.objectContaining({
          shopName: 'ZakPOS Demo',
          documentNumber: 'INV-20260913-0001',
          documentTitle: 'TAX INVOICE',
          customerName: 'Jane',
          lines: [{ name: 'Tea', qty: 2, unitPrice: 50, amount: 100 }],
          subtotal: 100,
          tax: 15,
          total: 115,
          paymentMethod: 'cash',
        }),
      );
    });

    it('throws NotFoundException for a cross-tenant / missing invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        service.generateInvoicePdf('inv-999', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
      expect(mockReceiptPdfService.render).not.toHaveBeenCalled();
    });
  });

  describe('findOne and findAll', () => {
    it('should return invoice by ID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(sampleInvoice);
      const result = await service.findOne('inv-1', 'tenant-1');
      expect(result.id).toBe('inv-1');
      expect(mockPrisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1', tenantId: 'tenant-1' },
        }),
      );
    });

    it('should throw NotFoundException if invoice not found by ID', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.findOne('inv-999', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return paginated invoices from findAll', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([sampleInvoice]);
      mockPrisma.invoice.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 10 }, 'tenant-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
    });
  });

  describe('status transitions: send, confirm, cancel', () => {
    it('should transition draft invoice to sent', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...sampleInvoice,
        status: 'draft',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        ...sampleInvoice,
        status: 'sent',
      });

      const result = await service.send('inv-1', 'tenant-1');
      expect(result.status).toBe('sent');
    });

    it('should throw BadRequestException if trying to send paid invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...sampleInvoice,
        status: 'paid',
      });

      await expect(service.send('inv-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should transition sent invoice to confirmed', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...sampleInvoice,
        status: 'sent',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        ...sampleInvoice,
        status: 'confirmed',
      });

      const result = await service.confirm('inv-1', 'tenant-1');
      expect(result.status).toBe('confirmed');
    });

    it('should cancel invoice if not paid', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...sampleInvoice,
        status: 'sent',
      });
      mockPrisma.invoice.update.mockResolvedValue({
        ...sampleInvoice,
        status: 'cancelled',
      });

      const result = await service.cancel('inv-1', 'tenant-1');
      expect(result.status).toBe('cancelled');
    });

    it('should throw BadRequestException when cancelling a paid invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue({
        ...sampleInvoice,
        status: 'paid',
      });

      await expect(service.cancel('inv-1', 'tenant-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
