import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { CategoryService } from './category.service';
import { DatabaseService } from '../database/database.service';

describe('CategoryService', () => {
  let service: CategoryService;

  const mockPrisma = {
    category: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
  };

  const sampleCategory = {
    id: 'c1',
    name: 'Beverages',
    parentId: null,
    path: 'beverages',
    tenantId: 'tenant-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoryService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<CategoryService>(CategoryService);
  });

  describe('create', () => {
    it('should create a root category with slugified path', async () => {
      mockPrisma.category.create.mockResolvedValue(sampleCategory);

      const result = await service.create({
        name: 'Beverages',
      });

      expect(result.id).toBe('c1');
      expect(result.path).toBe('beverages');
    });

    it('should create a subcategory with parent path prefixed', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleCategory);
      mockPrisma.category.create.mockResolvedValue({
        id: 'c2',
        name: 'Soft Drinks',
        parentId: 'c1',
        path: 'beverages/soft-drinks',
        tenantId: 'tenant-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create({
        name: 'Soft Drinks',
        parentId: 'c1',
      });

      expect(result.id).toBe('c2');
      expect(result.path).toBe('beverages/soft-drinks');
    });

    it('should throw NotFoundException if parent category not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Sub',
          parentId: 'non-existent',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll and findTree', () => {
    it('should return all categories', async () => {
      mockPrisma.category.findMany.mockResolvedValue([sampleCategory]);
      const result = await service.findAll('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });

    it('should build hierarchical tree of categories', async () => {
      const parent = { ...sampleCategory, id: 'c1', parentId: null };
      const child = { ...sampleCategory, id: 'c2', parentId: 'c1', name: 'Child', path: 'beverages/child' };

      mockPrisma.category.findMany.mockResolvedValue([parent, child]);
      const tree = await service.findTree('tenant-1');
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('c1');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe('c2');
    });
  });

  describe('findOne', () => {
    it('should return category by ID', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleCategory);
      const result = await service.findOne('c1');
      expect(result.id).toBe('c1');
    });

    it('should throw NotFoundException when category not found', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);
      await expect(service.findOne('c999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update category name and path', async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleCategory);
      mockPrisma.category.update.mockResolvedValue({
        ...sampleCategory,
        name: 'Drinks',
        path: 'drinks',
      });

      const result = await service.update('c1', { name: 'Drinks' });
      expect(result.name).toBe('Drinks');
      expect(result.path).toBe('drinks');
    });
  });

  describe('remove', () => {
    it('should throw ConflictException if category has children', async () => {
      mockPrisma.category.findMany.mockResolvedValue([{ id: 'c2', parentId: 'c1' }]);

      await expect(service.remove('c1')).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if products exist in category', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(5);

      await expect(service.remove('c1')).rejects.toThrow(ConflictException);
    });

    it('should remove category when no children and no products', async () => {
      mockPrisma.category.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);
      mockPrisma.category.delete.mockResolvedValue(sampleCategory);

      const result = await service.remove('c1');
      expect(result).toEqual({ success: true });
    });
  });
});
