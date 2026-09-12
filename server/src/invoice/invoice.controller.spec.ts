import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('InvoiceController', () => {
  let controller: InvoiceController;
  let service: InvoiceService;

  const mockInvoiceService = {
    create: jest.fn(),
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
      providers: [
        { provide: InvoiceService, useValue: mockInvoiceService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InvoiceController>(InvoiceController);
    service = module.get<InvoiceService>(InvoiceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to invoiceService.create', async () => {
      const dto = { shopId: 's1' };
      mockInvoiceService.create.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.create(dto);
      expect(result).toEqual({ id: 'inv-1' });
      expect(mockInvoiceService.create).toHaveBeenCalledWith(dto, 'system');
    });
  });

  describe('findAll', () => {
    it('should delegate to invoiceService.findAll', async () => {
      mockInvoiceService.findAll.mockResolvedValue([]);
      const result = await controller.findAll({});
      expect(result).toEqual([]);
      expect(mockInvoiceService.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should delegate to invoiceService.findOne', async () => {
      mockInvoiceService.findOne.mockResolvedValue({ id: 'inv-1' });
      const result = await controller.findOne('inv-1');
      expect(result).toEqual({ id: 'inv-1' });
      expect(mockInvoiceService.findOne).toHaveBeenCalledWith('inv-1');
    });
  });

  describe('send', () => {
    it('should delegate to invoiceService.send', async () => {
      mockInvoiceService.send.mockResolvedValue({ id: 'inv-1', status: 'sent' });
      const result = await controller.send('inv-1');
      expect(result).toEqual({ id: 'inv-1', status: 'sent' });
      expect(mockInvoiceService.send).toHaveBeenCalledWith('inv-1');
    });
  });

  describe('confirm', () => {
    it('should delegate to invoiceService.confirm', async () => {
      mockInvoiceService.confirm.mockResolvedValue({ id: 'inv-1', status: 'confirmed' });
      const result = await controller.confirm('inv-1');
      expect(result).toEqual({ id: 'inv-1', status: 'confirmed' });
      expect(mockInvoiceService.confirm).toHaveBeenCalledWith('inv-1');
    });
  });

  describe('cancel', () => {
    it('should delegate to invoiceService.cancel', async () => {
      mockInvoiceService.cancel.mockResolvedValue({ id: 'inv-1', status: 'cancelled' });
      const result = await controller.cancel('inv-1');
      expect(result).toEqual({ id: 'inv-1', status: 'cancelled' });
      expect(mockInvoiceService.cancel).toHaveBeenCalledWith('inv-1');
    });
  });
});
