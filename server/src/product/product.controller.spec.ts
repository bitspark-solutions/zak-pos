import { Test, TestingModule } from '@nestjs/testing';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

describe('ProductController', () => {
  let controller: ProductController;

  const mockProductService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findByBarcode: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    attachBarcode: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: mockProductService }],
    }).compile();

    controller = module.get<ProductController>(ProductController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should delegate to productService.create', async () => {
      const dto = { name: 'P1', sku: 'SKU1', basePrice: 100 };
      mockProductService.create.mockResolvedValue({ id: 'p1', ...dto });

      const result = await controller.create(dto, 'tenant-1');
      expect(result.id).toBe('p1');
      expect(mockProductService.create).toHaveBeenCalledWith(dto, 'tenant-1');
    });
  });

  describe('findAll', () => {
    it('should delegate to productService.findAll', async () => {
      const mockResult = {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      mockProductService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(
        { page: 1, limit: 10 },
        'tenant-1',
      );
      expect(result).toEqual(mockResult);
      expect(mockProductService.findAll).toHaveBeenCalledWith(
        { page: 1, limit: 10 },
        'tenant-1',
      );
    });
  });

  describe('findByBarcode', () => {
    it('should delegate to productService.findByBarcode', async () => {
      mockProductService.findByBarcode.mockResolvedValue({ id: 'p1' });

      const result = await controller.findByBarcode('123456', 'tenant-1');
      expect(result).toEqual({ id: 'p1' });
      expect(mockProductService.findByBarcode).toHaveBeenCalledWith(
        '123456',
        'tenant-1',
      );
    });
  });

  describe('findOne', () => {
    it('should delegate to productService.findOne', async () => {
      mockProductService.findOne.mockResolvedValue({ id: 'p1' });

      const result = await controller.findOne('p1', 'tenant-1');
      expect(result).toEqual({ id: 'p1' });
      expect(mockProductService.findOne).toHaveBeenCalledWith('p1', 'tenant-1');
    });
  });

  describe('update', () => {
    it('should delegate to productService.update', async () => {
      mockProductService.update.mockResolvedValue({
        id: 'p1',
        name: 'Updated',
      });

      const result = await controller.update(
        'p1',
        { name: 'Updated' },
        'tenant-1',
      );
      expect(result).toEqual({ id: 'p1', name: 'Updated' });
      expect(mockProductService.update).toHaveBeenCalledWith(
        'p1',
        { name: 'Updated' },
        'tenant-1',
      );
    });
  });

  describe('attachBarcode', () => {
    it('should delegate to productService.attachBarcode', async () => {
      const barcode = {
        id: 'b1',
        productId: 'p1',
        variantId: null,
        type: 'ean13',
        value: '8801111000015',
        isPrimary: false,
      };
      mockProductService.attachBarcode.mockResolvedValue(barcode);

      const result = await controller.attachBarcode(
        'p1',
        { value: '8801111000015' },
        'tenant-1',
      );
      expect(result).toEqual(barcode);
      expect(mockProductService.attachBarcode).toHaveBeenCalledWith(
        'p1',
        '8801111000015',
        'tenant-1',
      );
    });
  });

  describe('remove', () => {
    it('should delegate to productService.remove', async () => {
      mockProductService.remove.mockResolvedValue({ success: true });

      const result = await controller.remove('p1', 'tenant-1');
      expect(result).toEqual({ success: true });
      expect(mockProductService.remove).toHaveBeenCalledWith('p1', 'tenant-1');
    });
  });
});
