import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { DatabaseService } from '../database/database.service';

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
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: DatabaseService, useValue: mockDatabaseService },
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
