import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import type {
  CommitSaleDto,
  RefundSaleDto,
} from './interfaces/sales.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('SalesController', () => {
  let controller: SalesController;

  const mockSalesService = {
    commitSale: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdWithLines: jest.fn(),
    getSaleReceiptPdf: jest.fn(),
    refund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [{ provide: SalesService, useValue: mockSalesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SalesController>(SalesController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('commit', () => {
    it('should delegate to salesService.commitSale with the tenant id', async () => {
      const dto: CommitSaleDto = { cartToken: 'tok-1', paymentMethod: 'cash' };
      mockSalesService.commitSale.mockResolvedValue({
        sale: { id: 's1' },
        lines: [],
      });

      const result = await controller.commit(dto, 'tenant-1');
      expect(result).toEqual({ sale: { id: 's1' }, lines: [] });
      expect(mockSalesService.commitSale).toHaveBeenCalledWith(dto, 'tenant-1');
    });
  });

  describe('findAll', () => {
    it('should delegate to salesService.findAll with tenant first', async () => {
      mockSalesService.findAll.mockResolvedValue([{ id: 's1' }]);
      const result = await controller.findAll('tenant-1', 'shop-1');
      expect(result).toEqual([{ id: 's1' }]);
      expect(mockSalesService.findAll).toHaveBeenCalledWith(
        'tenant-1',
        'shop-1',
      );
    });

    it('should pass an undefined shopId through', async () => {
      mockSalesService.findAll.mockResolvedValue([]);
      await controller.findAll('tenant-1');
      expect(mockSalesService.findAll).toHaveBeenCalledWith(
        'tenant-1',
        undefined,
      );
    });
  });

  describe('findById', () => {
    it('should delegate to salesService.findById with the tenant id', async () => {
      mockSalesService.findById.mockResolvedValue({ id: 's1' });
      const result = await controller.findById('s1', 'tenant-1');
      expect(result).toEqual({ id: 's1' });
      expect(mockSalesService.findById).toHaveBeenCalledWith('s1', 'tenant-1');
    });
  });

  describe('findByIdWithLines', () => {
    it('should delegate to salesService.findByIdWithLines with the tenant id', async () => {
      mockSalesService.findByIdWithLines.mockResolvedValue({
        sale: { id: 's1' },
        lines: [],
      });
      const result = await controller.findByIdWithLines('s1', 'tenant-1');
      expect(result).toEqual({ sale: { id: 's1' }, lines: [] });
      expect(mockSalesService.findByIdWithLines).toHaveBeenCalledWith(
        's1',
        'tenant-1',
      );
    });
  });

  describe('receipt', () => {
    it('sends the sale receipt PDF bytes with a pdf content-type', async () => {
      const buffer = Buffer.from('%PDF-1.4 receipt');
      mockSalesService.getSaleReceiptPdf.mockResolvedValue({
        buffer,
        filename: 'sale-s1.pdf',
      });
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await controller.receipt('s1', 'tenant-1', res as any);

      expect(mockSalesService.getSaleReceiptPdf).toHaveBeenCalledWith(
        's1',
        'tenant-1',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(res.send).toHaveBeenCalledWith(buffer);
    });
  });

  describe('refund', () => {
    it('should delegate to salesService.refund with the tenant id last', async () => {
      const dto: RefundSaleDto = { refundMethod: 'cash', reason: 'damaged' };
      mockSalesService.refund.mockResolvedValue({
        id: 's1',
        status: 'refunded',
      });
      const result = await controller.refund('s1', dto, 'tenant-1');
      expect(result).toEqual({ id: 's1', status: 'refunded' });
      expect(mockSalesService.refund).toHaveBeenCalledWith(
        's1',
        dto,
        'tenant-1',
      );
    });
  });
});
