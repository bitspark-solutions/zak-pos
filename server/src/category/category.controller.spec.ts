import { Test, TestingModule } from '@nestjs/testing';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

describe('CategoryController', () => {
  let controller: CategoryController;

  const mockCategoryService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findTree: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoryController],
      providers: [{ provide: CategoryService, useValue: mockCategoryService }],
    }).compile();

    controller = module.get<CategoryController>(CategoryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to categoryService.create', async () => {
      const dto = { name: 'Cat 1' };
      mockCategoryService.create.mockResolvedValue({ id: 'c1', ...dto });
      const result = await controller.create(dto, 'tenant-1');
      expect(result.id).toBe('c1');
      expect(mockCategoryService.create).toHaveBeenCalledWith(dto, 'tenant-1');
    });
  });

  describe('findAll', () => {
    it('should delegate to categoryService.findAll', async () => {
      mockCategoryService.findAll.mockResolvedValue([]);
      const result = await controller.findAll('tenant-1');
      expect(result).toEqual([]);
      expect(mockCategoryService.findAll).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('findTree', () => {
    it('should delegate to categoryService.findTree', async () => {
      mockCategoryService.findTree.mockResolvedValue([]);
      const result = await controller.findTree('tenant-1');
      expect(result).toEqual([]);
      expect(mockCategoryService.findTree).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('findOne', () => {
    it('should delegate to categoryService.findOne', async () => {
      mockCategoryService.findOne.mockResolvedValue({ id: 'c1' });
      const result = await controller.findOne('c1', 'tenant-1');
      expect(result).toEqual({ id: 'c1' });
      expect(mockCategoryService.findOne).toHaveBeenCalledWith(
        'c1',
        'tenant-1',
      );
    });
  });

  describe('update', () => {
    it('should delegate to categoryService.update', async () => {
      mockCategoryService.update.mockResolvedValue({ id: 'c1', name: 'Up' });
      const result = await controller.update('c1', { name: 'Up' }, 'tenant-1');
      expect(result).toEqual({ id: 'c1', name: 'Up' });
      expect(mockCategoryService.update).toHaveBeenCalledWith(
        'c1',
        { name: 'Up' },
        'tenant-1',
      );
    });
  });

  describe('remove', () => {
    it('should delegate to categoryService.remove', async () => {
      mockCategoryService.remove.mockResolvedValue({ success: true });
      const result = await controller.remove('c1', 'tenant-1');
      expect(result).toEqual({ success: true });
      expect(mockCategoryService.remove).toHaveBeenCalledWith('c1', 'tenant-1');
    });
  });
});
