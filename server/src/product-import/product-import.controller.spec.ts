import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProductImportController } from './product-import.controller';
import { ProductImportService } from './product-import.service';
import type { PreviewResult } from './interfaces/product-import.interface';

describe('ProductImportController', () => {
  let controller: ProductImportController;

  const previewResult: PreviewResult = {
    uploadId: 'upl-1',
    files: [{ name: 'menu.csv', kind: 'sheet' }],
    candidates: [],
    total: 0,
  };

  const mockService = {
    preview: jest.fn(),
    getPreview: jest.fn(),
    commit: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductImportController],
      providers: [{ provide: ProductImportService, useValue: mockService }],
    }).compile();

    controller = module.get<ProductImportController>(ProductImportController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('preview delegates to the service with the tenant id', async () => {
    mockService.preview.mockResolvedValue(previewResult);
    const files = [
      {
        originalname: 'menu.csv',
        mimetype: 'text/csv',
        buffer: Buffer.from('a'),
        size: 1,
      },
    ];

    const result = await controller.preview(files, 'tenant-1');

    expect(result).toEqual(previewResult);
    expect(mockService.preview).toHaveBeenCalledWith(files, 'tenant-1');
  });

  it('preview rejects when no files are uploaded', async () => {
    await expect(controller.preview([], 'tenant-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      controller.preview(undefined, 'tenant-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('getPreview and commit pass through arguments', async () => {
    mockService.getPreview.mockResolvedValue({ ok: true });
    mockService.commit.mockResolvedValue({
      created: [],
      conflicts: [],
      skipped: [],
    });

    await controller.getPreview('upl-1', 'tenant-1');
    expect(mockService.getPreview).toHaveBeenCalledWith('upl-1', 'tenant-1');

    await controller.commit(
      { uploadId: 'upl-1', candidateIds: [0, 2] },
      'tenant-1',
    );
    expect(mockService.commit).toHaveBeenCalledWith(
      'upl-1',
      [0, 2],
      'tenant-1',
      [],
    );

    const overrides = [{ candidateId: 2, name: 'Renamed row', basePrice: 99 }];
    await controller.commit(
      { uploadId: 'upl-1', candidateIds: [0, 2], overrides },
      'tenant-1',
    );
    expect(mockService.commit).toHaveBeenCalledWith(
      'upl-1',
      [0, 2],
      'tenant-1',
      overrides,
    );
  });
});
