import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

describe('InventoryController', () => {
  let controller: InventoryController;
  let service: InventoryService;

  const mockInventoryService = {
    getStock: jest.fn(),
    adjustStock: jest.fn(),
    getMovements: jest.fn(),
    checkAvailability: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    service = module.get<InventoryService>(InventoryService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStock', () => {
    it('should delegate to inventoryService.getStock', async () => {
      mockInventoryService.getStock.mockResolvedValue([]);
      const result = await controller.getStock({ shopId: 's1' });
      expect(result).toEqual([]);
      expect(mockInventoryService.getStock).toHaveBeenCalledWith({ shopId: 's1' });
    });
  });

  describe('adjustStock', () => {
    it('should delegate to inventoryService.adjustStock', async () => {
      const dto = { shopId: 's1', productId: 'p1', quantity: 5, type: 'IN' as const };
      mockInventoryService.adjustStock.mockResolvedValue({ success: true });
      const result = await controller.adjustStock(dto);
      expect(result).toEqual({ success: true });
      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(dto);
    });
  });

  describe('getMovements', () => {
    it('should delegate to inventoryService.getMovements', async () => {
      mockInventoryService.getMovements.mockResolvedValue([]);
      const result = await controller.getMovements({ shopId: 's1' });
      expect(result).toEqual([]);
      expect(mockInventoryService.getMovements).toHaveBeenCalledWith({ shopId: 's1' });
    });
  });

  describe('checkAvailability', () => {
    it('should delegate to inventoryService.checkAvailability', async () => {
      mockInventoryService.checkAvailability.mockResolvedValue({ isAvailable: true, items: [] });
      const result = await controller.checkAvailability({
        shopId: 's1',
        items: [{ productId: 'p1', quantity: 2 }],
      });
      expect(result).toEqual({ isAvailable: true, items: [] });
      expect(mockInventoryService.checkAvailability).toHaveBeenCalledWith('s1', [
        { productId: 'p1', quantity: 2 },
      ]);
    });
  });
});
