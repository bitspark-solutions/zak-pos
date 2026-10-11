import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import type {
  CreateCartDto,
  AddLineDto,
  UpdateLineDto,
} from './interfaces/cart.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('CartController', () => {
  let controller: CartController;

  const mockCartService = {
    create: jest.fn(),
    findByToken: jest.fn(),
    addLine: jest.fn(),
    updateLine: jest.fn(),
    removeLine: jest.fn(),
    recalculatePrice: jest.fn(),
    tender: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartController],
      providers: [{ provide: CartService, useValue: mockCartService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CartController>(CartController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to cartService.create with tenant and user id', async () => {
      const dto: CreateCartDto = { shopId: 's1' };
      mockCartService.create.mockResolvedValue({ id: 'c1' });
      const result = await controller.create(dto, 'tenant-1', 'user-1');
      expect(result).toEqual({ id: 'c1' });
      expect(mockCartService.create).toHaveBeenCalledWith(
        dto,
        'tenant-1',
        'user-1',
      );
    });
  });

  describe('findByToken', () => {
    it('should delegate to cartService.findByToken with the tenant id', async () => {
      mockCartService.findByToken.mockResolvedValue({ token: 'tok-1' });
      const result = await controller.findByToken('tok-1', 'tenant-1');
      expect(result).toEqual({ token: 'tok-1' });
      expect(mockCartService.findByToken).toHaveBeenCalledWith(
        'tok-1',
        'tenant-1',
      );
    });
  });

  describe('addLine', () => {
    it('should delegate to cartService.addLine with the tenant id last', async () => {
      const dto: AddLineDto = { productId: 'p1', qty: 2 };
      mockCartService.addLine.mockResolvedValue({
        token: 'tok-1',
        lines: [dto],
      });
      const result = await controller.addLine('tok-1', dto, 'tenant-1');
      expect(result).toEqual({ token: 'tok-1', lines: [dto] });
      expect(mockCartService.addLine).toHaveBeenCalledWith(
        'tok-1',
        dto,
        'tenant-1',
      );
    });
  });

  describe('updateLine', () => {
    it('should delegate to cartService.updateLine with the tenant id last', async () => {
      const dto: UpdateLineDto = { qty: 3 };
      mockCartService.updateLine.mockResolvedValue({ token: 'tok-1' });
      const result = await controller.updateLine(
        'tok-1',
        'l1',
        dto,
        'tenant-1',
      );
      expect(result).toEqual({ token: 'tok-1' });
      expect(mockCartService.updateLine).toHaveBeenCalledWith(
        'tok-1',
        'l1',
        dto,
        'tenant-1',
      );
    });
  });

  describe('removeLine', () => {
    it('should delegate to cartService.removeLine with the tenant id last', async () => {
      mockCartService.removeLine.mockResolvedValue({ token: 'tok-1' });
      const result = await controller.removeLine('tok-1', 'l1', 'tenant-1');
      expect(result).toEqual({ token: 'tok-1' });
      expect(mockCartService.removeLine).toHaveBeenCalledWith(
        'tok-1',
        'l1',
        'tenant-1',
      );
    });
  });

  describe('recalculatePrice', () => {
    it('should delegate to cartService.recalculatePrice with the tenant id', async () => {
      mockCartService.recalculatePrice.mockResolvedValue({
        token: 'tok-1',
        total: 215,
      });
      const result = await controller.recalculatePrice('tok-1', 'tenant-1');
      expect(result).toEqual({ token: 'tok-1', total: 215 });
      expect(mockCartService.recalculatePrice).toHaveBeenCalledWith(
        'tok-1',
        'tenant-1',
      );
    });
  });

  describe('tender, complete, cancel, delete', () => {
    it('should tender cart scoped to the tenant', async () => {
      mockCartService.tender.mockResolvedValue({ status: 'tendered' });
      const result = await controller.tender('tok-1', 'tenant-1');
      expect(result.status).toBe('tendered');
      expect(mockCartService.tender).toHaveBeenCalledWith('tok-1', 'tenant-1');
    });

    it('should complete cart scoped to the tenant', async () => {
      mockCartService.complete.mockResolvedValue({ status: 'completed' });
      const result = await controller.complete('tok-1', 'tenant-1');
      expect(result.status).toBe('completed');
      expect(mockCartService.complete).toHaveBeenCalledWith(
        'tok-1',
        'tenant-1',
      );
    });

    it('should cancel cart scoped to the tenant', async () => {
      mockCartService.cancel.mockResolvedValue({ status: 'cancelled' });
      const result = await controller.cancel('tok-1', 'tenant-1');
      expect(result.status).toBe('cancelled');
      expect(mockCartService.cancel).toHaveBeenCalledWith('tok-1', 'tenant-1');
    });

    it('should delete cart scoped to the tenant', async () => {
      mockCartService.delete.mockResolvedValue({ success: true });
      const result = await controller.delete('tok-1', 'tenant-1');
      expect(result).toEqual({ success: true });
      expect(mockCartService.delete).toHaveBeenCalledWith('tok-1', 'tenant-1');
    });
  });
});
