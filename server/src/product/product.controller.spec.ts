import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

describe('ProductController', () => {
  let controller: ProductController;
  let service: ProductService;

  const mockProductService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByBarcode: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [
        { provide: ProductService, useValue: mockProductService },
      ],
    }).compile();

    controller = module.get<ProductController>(ProductController);
    service = module.get<ProductService>(ProductService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to productService.create', async () => {
      const dto = { name: 'P1', sku: 'SKU1', basePrice: 100 };
      mockProductService.create.mockResolvedValue({ id: 'p1', ...dto });

      const result = await controller.create(dto);
      expect(result.id).toBe('p1');
      expect(mockProductService.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should delegate to productService.findAll', async () => {
      const mockResult = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
      mockProductService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll({ page: 1, limit: 10 });
      expect(result).toEqual(mockResult);
      expect(mockProductService.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 }, undefined);
    });
  });

  describe('findByBarcode', () => {
    it('should delegate to productService.findByBarcode', async () => {
      mockProductService.findByBarcode.mockResolvedValue({ id: 'p1' });

      const result = await controller.findByBarcode('123456');
      expect(result).toEqual({ id: 'p1' });
      expect(mockProductService.findByBarcode).toHaveBeenCalledWith('123456', undefined);
    });
  });

  describe('findOne', () => {
    it('should delegate to productService.findOne', async () => {
      mockProductService.findOne.mockResolvedValue({ id: 'p1' });

      const result = await controller.findOne('p1');
      expect(result).toEqual({ id: 'p1' });
      expect(mockProductService.findOne).toHaveBeenCalledWith('p1');
    });
  });

  describe('update', () => {
    it('should delegate to productService.update', async () => {
      mockProductService.update.mockResolvedValue({ id: 'p1', name: 'Updated' });

      const result = await controller.update('p1', { name: 'Updated' });
      expect(result).toEqual({ id: 'p1', name: 'Updated' });
      expect(mockProductService.update).toHaveBeenCalledWith('p1', { name: 'Updated' });
    });
  });

  describe('remove', () => {
    it('should delegate to productService.remove', async () => {
      mockProductService.remove.mockResolvedValue({ success: true });

      const result = await controller.remove('p1');
      expect(result).toEqual({ success: true });
      expect(mockProductService.remove).toHaveBeenCalledWith('p1');
    });
  });
});
