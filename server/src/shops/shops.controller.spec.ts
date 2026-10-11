import { Test, TestingModule } from '@nestjs/testing';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

describe('ShopsController', () => {
  let controller: ShopsController;

  const mockShopsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopsController],
      providers: [{ provide: ShopsService, useValue: mockShopsService }],
    }).compile();

    controller = module.get<ShopsController>(ShopsController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to shopsService.findAll with tenant and search', async () => {
      const mockResult = {
        data: [{ id: 's1' }],
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1,
      };
      mockShopsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ search: 'Main' }, 'tenant-1');

      expect(result).toEqual(mockResult);
      expect(mockShopsService.findAll).toHaveBeenCalledWith('tenant-1', 'Main');
    });
  });

  describe('create', () => {
    it('should delegate to shopsService.create', async () => {
      const dto = { name: 'Main Store', address: '123 High St' };
      mockShopsService.create.mockResolvedValue({ id: 's1', ...dto });

      const result = await controller.create(dto, 'tenant-1');

      expect(result.id).toBe('s1');
      expect(mockShopsService.create).toHaveBeenCalledWith(dto, 'tenant-1');
    });
  });

  describe('findOne', () => {
    it('should delegate to shopsService.findOne', async () => {
      mockShopsService.findOne.mockResolvedValue({ id: 's1' });

      const result = await controller.findOne('s1', 'tenant-1');

      expect(result).toEqual({ id: 's1' });
      expect(mockShopsService.findOne).toHaveBeenCalledWith('s1', 'tenant-1');
    });
  });

  describe('update', () => {
    it('should delegate to shopsService.update', async () => {
      mockShopsService.update.mockResolvedValue({
        id: 's1',
        name: 'Renamed',
      });

      const result = await controller.update(
        's1',
        { name: 'Renamed' },
        'tenant-1',
      );

      expect(result).toEqual({ id: 's1', name: 'Renamed' });
      expect(mockShopsService.update).toHaveBeenCalledWith(
        's1',
        { name: 'Renamed' },
        'tenant-1',
      );
    });
  });

  describe('remove', () => {
    it('should delegate to shopsService.remove', async () => {
      mockShopsService.remove.mockResolvedValue({ success: true });

      const result = await controller.remove('s1', 'tenant-1');

      expect(result).toEqual({ success: true });
      expect(mockShopsService.remove).toHaveBeenCalledWith('s1', 'tenant-1');
    });
  });
});
