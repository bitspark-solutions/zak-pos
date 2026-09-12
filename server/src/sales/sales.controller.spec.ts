import { Test, TestingModule } from '@nestjs/testing';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('SalesController', () => {
  let controller: SalesController;
  let service: SalesService;

  const mockSalesService = {
    commitSale: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdWithLines: jest.fn(),
    refund: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        { provide: SalesService, useValue: mockSalesService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SalesController>(SalesController);
    service = module.get<SalesService>(SalesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('commit', () => {
    it('should delegate to salesService.commitSale', async () => {
      const dto = { cartToken: 'tok-1', paymentMethod: 'cash' };
      mockSalesService.commitSale.mockResolvedValue({ sale: { id: 's1' }, lines: [] });

      const result = await controller.commit(dto);
      expect(result).toEqual({ sale: { id: 's1' }, lines: [] });
      expect(mockSalesService.commitSale).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to salesService.findAll', async () => {
      mockSalesService.findAll.mockResolvedValue([{ id: 's1' }]);
      const result = await controller.findAll('tenant-1', 'shop-1');
      expect(result).toEqual([{ id: 's1' }]);
      expect(mockSalesService.findAll).toHaveBeenCalledWith('tenant-1', 'shop-1');
    });
  });

  describe('findById', () => {
    it('should delegate to salesService.findById', async () => {
      mockSalesService.findById.mockResolvedValue({ id: 's1' });
      const result = await controller.findById('s1');
      expect(result).toEqual({ id: 's1' });
      expect(mockSalesService.findById).toHaveBeenCalledWith('s1');
    });
  });

  describe('findByIdWithLines', () => {
    it('should delegate to salesService.findByIdWithLines', async () => {
      mockSalesService.findByIdWithLines.mockResolvedValue({ sale: { id: 's1' }, lines: [] });
      const result = await controller.findByIdWithLines('s1');
      expect(result).toEqual({ sale: { id: 's1' }, lines: [] });
      expect(mockSalesService.findByIdWithLines).toHaveBeenCalledWith('s1');
    });
  });

  describe('refund', () => {
    it('should delegate to salesService.refund', async () => {
      const dto = { refundMethod: 'cash' };
      mockSalesService.refund.mockResolvedValue({ id: 's1', status: 'refunded' });
      const result = await controller.refund('s1', dto);
      expect(result).toEqual({ id: 's1', status: 'refunded' });
      expect(mockSalesService.refund).toHaveBeenCalledWith('s1', dto);
    });
  });
});
