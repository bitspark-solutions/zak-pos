import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('InvoiceController', () => {
  let controller: InvoiceController;

  const mockInvoiceService = {
    create: jest.fn(),
    createFromSale: jest.fn(),
    generateInvoicePdf: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    send: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoiceController],
      providers: [{ provide: InvoiceService, useValue: mockInvoiceService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoiceController>(InvoiceController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to invoiceService.create', async () => {
      const dto = { shopId: 's1' };
      mockInvoiceService.create.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.create(dto, 'tenant-1', 'user-1');
      expect(result).toEqual({ id: 'inv-1' });
      expect(mockInvoiceService.create).toHaveBeenCalledWith(
        dto,
        'user-1',
        'tenant-1',
      );
    });
  });

  describe('createFromSale', () => {
    it('creates an invoice and responds 201', async () => {
      mockInvoiceService.createFromSale.mockResolvedValue({
        invoice: { id: 'inv-1' },
        created: true,
      });
      const res = { status: jest.fn().mockReturnThis() };

      const result = await controller.createFromSale(
        { saleId: 'sale-1' },
        'tenant-1',
        'user-1',
        res as any,
      );

      expect(result).toEqual({ id: 'inv-1' });
      expect(mockInvoiceService.createFromSale).toHaveBeenCalledWith(
        'sale-1',
        'user-1',
        'tenant-1',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
    });

    it('returns the existing invoice with a 200 (idempotent)', async () => {
      mockInvoiceService.createFromSale.mockResolvedValue({
        invoice: { id: 'inv-1' },
        created: false,
      });
      const res = { status: jest.fn().mockReturnThis() };

      await controller.createFromSale(
        { saleId: 'sale-1' },
        'tenant-1',
        'user-1',
        res as any,
      );

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    });
  });

  describe('getPdf', () => {
    it('sends the invoice PDF bytes with a pdf content-type', async () => {
      const buffer = Buffer.from('%PDF-1.4 bytes');
      mockInvoiceService.generateInvoicePdf.mockResolvedValue({
        buffer,
        filename: 'INV-20260913-0001.pdf',
      });
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.getPdf('inv-1', 'tenant-1', res as any);

      expect(mockInvoiceService.generateInvoicePdf).toHaveBeenCalledWith(
        'inv-1',
        'tenant-1',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="INV-20260913-0001.pdf"',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(buffer);
    });
  });

  describe('findAll', () => {
    it('should delegate to invoiceService.findAll', async () => {
      mockInvoiceService.findAll.mockResolvedValue([]);
      const result = await controller.findAll({}, 'tenant-1');
      expect(result).toEqual([]);
      expect(mockInvoiceService.findAll).toHaveBeenCalledWith({}, 'tenant-1');
    });
  });

  describe('findOne', () => {
    it('should delegate to invoiceService.findOne', async () => {
      mockInvoiceService.findOne.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.findOne('inv-1', 'tenant-1');
      expect(result).toEqual({ id: 'inv-1' });
      expect(mockInvoiceService.findOne).toHaveBeenCalledWith(
        'inv-1',
        'tenant-1',
      );
    });
  });

  describe('send', () => {
    it('should delegate to invoiceService.send', async () => {
      mockInvoiceService.send.mockResolvedValue({
        id: 'inv-1',
        status: 'sent',
      });
      const result = await controller.send('inv-1', 'tenant-1');
      expect(result).toEqual({ id: 'inv-1', status: 'sent' });
      expect(mockInvoiceService.send).toHaveBeenCalledWith('inv-1', 'tenant-1');
    });
  });

  describe('confirm', () => {
    it('should delegate to invoiceService.confirm', async () => {
      mockInvoiceService.confirm.mockResolvedValue({
        id: 'inv-1',
        status: 'confirmed',
      });
      const result = await controller.confirm('inv-1', 'tenant-1');
      expect(result).toEqual({ id: 'inv-1', status: 'confirmed' });
      expect(mockInvoiceService.confirm).toHaveBeenCalledWith(
        'inv-1',
        'tenant-1',
      );
    });
  });

  describe('cancel', () => {
    it('should delegate to invoiceService.cancel', async () => {
      mockInvoiceService.cancel.mockResolvedValue({
        id: 'inv-1',
        status: 'cancelled',
      });
      const result = await controller.cancel('inv-1', 'tenant-1');
      expect(result).toEqual({ id: 'inv-1', status: 'cancelled' });
      expect(mockInvoiceService.cancel).toHaveBeenCalledWith(
        'inv-1',
        'tenant-1',
      );
    });
  });
});
