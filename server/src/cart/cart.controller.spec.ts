import { Test, TestingModule } from '@nestjs/testing';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('CartController', () => {
  let controller: CartController;
  let service: CartService;

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
      providers: [
        { provide: CartService, useValue: mockCartService },
      ],
    })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CartController>(CartController);
    service = module.get<CartService>(CartService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to cartService.create', async () => {
      const dto = { shopId: 's1' };
      mockCartService.create.mockResolvedValue({ id: 'c1' });
      const result = await controller.create(dto);
      expect(result).toEqual({ id: 'c1' });
      expect(mockCartService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findByToken', () => {
    it('should delegate to cartService.findByToken', async () => {
      mockCartService.findByToken.mockResolvedValue({ token: 'tok-1' });
      const result = await controller.findByToken('tok-1');
      expect(result).toEqual({ token: 'tok-1' });
      expect(mockCartService.findByToken).toHaveBeenCalledWith('tok-1');
    });
  });

  describe('addLine', () => {
    it('should delegate to cartService.addLine', async () => {
      const dto = { productId: 'p1', qty: 2 };
      mockCartService.addLine.mockResolvedValue({ token: 'tok-1', lines: [dto] });
      const result = await controller.addLine('tok-1', dto);
      expect(result).toEqual({ token: 'tok-1', lines: [dto] });
      expect(mockCartService.addLine).toHaveBeenCalledWith('tok-1', dto);
    });
  });

  describe('updateLine', () => {
    it('should delegate to cartService.updateLine', async () => {
      const dto = { qty: 3 };
      mockCartService.updateLine.mockResolvedValue({ token: 'tok-1' });
      const result = await controller.updateLine('tok-1', 'l1', dto);
      expect(result).toEqual({ token: 'tok-1' });
      expect(mockCartService.updateLine).toHaveBeenCalledWith('tok-1', 'l1', dto);
    });
  });

  describe('removeLine', () => {
    it('should delegate to cartService.removeLine', async () => {
      mockCartService.removeLine.mockResolvedValue({ token: 'tok-1' });
      const result = await controller.removeLine('tok-1', 'l1');
      expect(result).toEqual({ token: 'tok-1' });
      expect(mockCartService.removeLine).toHaveBeenCalledWith('tok-1', 'l1');
    });
  });

  describe('tender, complete, cancel, delete', () => {
    it('should tender cart', async () => {
      mockCartService.tender.mockResolvedValue({ status: 'tendered' });
      const result = await controller.tender('tok-1');
      expect(result.status).toBe('tendered');
    });

    it('should complete cart', async () => {
      mockCartService.complete.mockResolvedValue({ status: 'completed' });
      const result = await controller.complete('tok-1');
      expect(result.status).toBe('completed');
    });

    it('should cancel cart', async () => {
      mockCartService.cancel.mockResolvedValue({ status: 'cancelled' });
      const result = await controller.cancel('tok-1');
      expect(result.status).toBe('cancelled');
    });

    it('should delete cart', async () => {
      mockCartService.delete.mockResolvedValue({ success: true });
      const result = await controller.delete('tok-1');
      expect(result).toEqual({ success: true });
    });
  });
});
