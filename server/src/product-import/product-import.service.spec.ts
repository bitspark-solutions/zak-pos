import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProductImportService, barcodeTypeFor } from './product-import.service';
import { OcrService } from './ocr.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import type { ImportCachePayload } from './interfaces/product-import.interface';

const IMPORT_TTL_SECONDS = 3600;

function csvBuffer(content: string): Buffer {
  return Buffer.from(content, 'utf8');
}

function sheetFile(
  name: string,
  content: string,
): {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
} {
  return {
    originalname: name,
    mimetype: 'text/csv',
    buffer: csvBuffer(content),
  };
}

function pngFile(name: string): {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
} {
  return {
    originalname: name,
    mimetype: 'image/png',
    buffer: Buffer.from([0]),
  };
}

describe('ProductImportService', () => {
  let service: ProductImportService;

  // In-memory Redis double: JSON key/value store (mirrors SessionService spec).
  let kv: Map<string, unknown>;
  let mockRedis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    ttl: jest.Mock;
    del: jest.Mock;
  };

  const mockPrisma = {
    product: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    category: {
      findFirst: jest.fn(),
    },
    barcode: {
      create: jest.fn(),
    },
  };

  const mockDatabaseService = {
    withTenant: jest.fn(
      (tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockPrisma),
    ),
  };

  let autoId = 0;

  beforeEach(async () => {
    jest.clearAllMocks();
    autoId = 0;

    // OCR disabled by default for the deterministic tests.
    delete process.env.OCR_SERVICE_URL;
    delete process.env.OCR_API_KEY;

    kv = new Map();
    mockRedis = {
      getJson: jest.fn(async (key: string) =>
        kv.has(key) ? JSON.parse(JSON.stringify(kv.get(key))) : null,
      ),
      setJson: jest.fn(async (key: string, value: unknown) => {
        kv.set(key, value);
      }),
      ttl: jest.fn(async (_key: string) => IMPORT_TTL_SECONDS),
      del: jest.fn(async (key: string) => {
        kv.delete(key);
      }),
    };

    // Defaults: no existing product, no matching category.
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.create.mockImplementation(
      async ({ data }: { data: { name: string; sku: string } }) => ({
        id: `prod-${(autoId += 1)}`,
        name: data.name,
        sku: data.sku,
      }),
    );
    mockPrisma.category.findFirst.mockResolvedValue(null);
    mockPrisma.barcode.create.mockResolvedValue({ id: 'bc-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductImportService,
        OcrService,
        { provide: RedisService, useValue: mockRedis },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ProductImportService>(ProductImportService);
  });

  function seedCache(
    tenantId: string,
    uploadId: string,
    payload: ImportCachePayload,
  ): void {
    kv.set(`pimport:${uploadId}`, payload);
    kv.set(`pimport:tenant:${tenantId}`, [uploadId]);
  }

  describe('preview — CSV/XLSX header-driven mapping', () => {
    it('maps alias headers, parses BDT/৳ currency strings and flags bad rows', async () => {
      const csv = [
        'Product Title,Item Code,Sale Price,PurchasePrice,UoM,Category,Barcodes',
        'Tea Powder,tea-01,৳120.50,৳90,kilo,Grocery,8801111000015;12345',
        'Rice,BD rice,"BDT 1,200",,kg,Fresh,999',
        'No Price Item,np-1,,5,pcs,,',
        ',,5,5,pcs,,',
      ].join('\n');

      const result = await service.preview(
        [sheetFile('menu.csv', csv)],
        'tenant-1',
      );

      expect(result.uploadId).toBeDefined();
      expect(result.files).toEqual([{ name: 'menu.csv', kind: 'sheet' }]);
      expect(result.total).toBe(4);

      // Row 0: fully mapped, barcodes validated (only the 13-digit + 5-digit kept).
      const tea = result.candidates[0];
      expect(tea).toMatchObject({
        candidateId: 0,
        name: 'Tea Powder',
        sku: 'TEA-01',
        basePrice: 120.5,
        defaultCost: 90,
        unit: 'kilo',
        categoryName: 'Grocery',
        flagged: false,
      });
      expect(tea.barcodes).toEqual(['8801111000015', '12345']);

      // Row 1: "BDT 1,200" -> 1200, empty cost -> null, unit default kept 'kg'.
      expect(result.candidates[1].basePrice).toBe(1200);
      expect(result.candidates[1].defaultCost).toBeNull();

      // Row 2: missing price -> kept but flagged.
      const noPrice = result.candidates[2];
      expect(noPrice.basePrice).toBeNull();
      expect(noPrice.flagged).toBe(true);
      expect(noPrice.flags).toContain('missing or invalid price');
      expect(noPrice.unit).toBe('pcs'); // default applied for blank... but here 'pcs' supplied

      // Row 3: missing name -> flagged.
      expect(result.candidates[3].flagged).toBe(true);
      expect(result.candidates[3].flags).toContain('missing name');

      // Cache persisted with tenant scoping + TTL.
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        `pimport:${result.uploadId}`,
        expect.objectContaining({
          tenantId: 'tenant-1',
          uploadId: result.uploadId,
        }),
        IMPORT_TTL_SECONDS,
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        'pimport:tenant:tenant-1',
        [result.uploadId],
        IMPORT_TTL_SECONDS,
      );
    });

    it('records a per-file error and skips OCR when OCR_SERVICE_URL is unset', async () => {
      const result = await service.preview(
        [pngFile('receipt.png')],
        'tenant-1',
      );

      expect(result.files[0].kind).toBe('ocr');
      expect(result.files[0].error).toContain('OCR_SERVICE_URL');
      expect(result.candidates).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('maps OCR products into candidates when the OCR service is enabled', async () => {
      process.env.OCR_SERVICE_URL = 'http://ocr.test:58000';
      jest.spyOn(OcrService.prototype, 'extractProducts').mockResolvedValue({
        products: [
          {
            name: ' Basmati Rice ',
            sku: 'br-10',
            price: 250,
            unit: null,
            barcodes: ['8801111000015', 'abc'],
          },
          { name: '', sku: null, price: null, unit: null, barcodes: [] },
        ],
        raw_text: '...',
        engine: 'paddleocr',
        count: 2,
      });

      const result = await service.preview(
        [pngFile('catalog.png')],
        'tenant-1',
      );

      expect(result.files[0].error).toBeUndefined();
      expect(result.total).toBe(2);
      expect(result.candidates[0]).toMatchObject({
        candidateId: 0,
        name: 'Basmati Rice',
        sku: 'BR-10',
        basePrice: 250,
        defaultCost: null,
        unit: 'pcs',
        categoryName: null,
        barcodes: ['8801111000015'],
        flagged: false,
      });
      expect(result.candidates[1].flagged).toBe(true);
    });

    it('reports an error for an unsupported file type', async () => {
      const result = await service.preview(
        [
          {
            originalname: 'notes.txt',
            mimetype: 'text/plain',
            buffer: Buffer.from('hello'),
          },
        ],
        'tenant-1',
      );

      expect(result.files[0].error).toContain('Unsupported file type');
      expect(result.total).toBe(0);
    });

    it('returns 404 when reading a cached preview that expired', async () => {
      await expect(
        service.getPreview('missing-upload', 'tenant-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to return another tenant’s cached preview (treated as gone)', async () => {
      const payload: ImportCachePayload = {
        tenantId: 'tenant-2',
        uploadId: 'upl-x',
        candidates: [],
        createdAt: new Date().toISOString(),
      };
      seedCache('tenant-2', 'upl-x', payload);

      await expect(
        service.getPreview('upl-x', 'tenant-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('commit', () => {
    const baseCandidate = {
      candidateId: 0,
      fileName: 'menu.csv',
      name: 'Tea Powder',
      sku: 'TEA-01',
      basePrice: 120.5,
      defaultCost: 90,
      unit: 'kilo',
      categoryName: null,
      barcodes: ['8801111000015', '12345'],
      flagged: false,
      flags: [] as string[],
    };

    function payloadFor(
      tenantId: string,
      uploadId: string,
      candidates: ImportCachePayload['candidates'],
    ): ImportCachePayload {
      return {
        tenantId,
        uploadId,
        candidates,
        createdAt: new Date().toISOString(),
      };
    }

    it('creates the product and its barcode rows (primary first, type inferred)', async () => {
      seedCache(
        'tenant-1',
        'upl-1',
        payloadFor('tenant-1', 'upl-1', [baseCandidate]),
      );

      const result = await service.commit('upl-1', [0], 'tenant-1');

      expect(result.created).toHaveLength(1);
      expect(result.created[0]).toMatchObject({
        name: 'Tea Powder',
        sku: 'TEA-01',
      });
      expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.barcode.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.barcode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'ean13',
          value: '8801111000015',
          isPrimary: true,
        }),
      });
      expect(mockPrisma.barcode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'code128',
          value: '12345',
          isPrimary: false,
        }),
      });
      // Cache dropped after commit.
      expect(mockRedis.del).toHaveBeenCalledWith('pimport:upl-1');
    });

    it('generates a SKU from the name slug when none is supplied', async () => {
      seedCache(
        'tenant-1',
        'upl-gen',
        payloadFor('tenant-1', 'upl-gen', [
          { ...baseCandidate, candidateId: 0, sku: null, barcodes: [] },
        ]),
      );

      const result = await service.commit('upl-gen', [0], 'tenant-1');

      const created = mockPrisma.product.create.mock.calls[0]?.[0] as {
        data: { sku: string };
      };
      expect(created.data.sku).toMatch(/^tea-powder-[0-9A-F]{6}$/);
      expect(result.created[0].sku).toBe(created.data.sku);
    });

    it('records a conflict when the (tenant, sku) pair already exists', async () => {
      mockPrisma.product.findFirst.mockResolvedValueOnce({ id: 'existing' });
      seedCache(
        'tenant-1',
        'upl-dup',
        payloadFor('tenant-1', 'upl-dup', [baseCandidate]),
      );

      const result = await service.commit('upl-dup', [0], 'tenant-1');

      expect(result.created).toHaveLength(0);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toMatchObject({
        candidateId: 0,
        name: 'Tea Powder',
        reason: 'SKU TEA-01 already exists',
      });
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
    });

    it('skips a candidate missing a price and resolves category by name', async () => {
      mockPrisma.category.findFirst.mockResolvedValueOnce({ id: 'cat-77' });
      seedCache(
        'tenant-1',
        'upl-mix',
        payloadFor('tenant-1', 'upl-mix', [
          {
            ...baseCandidate,
            candidateId: 0,
            categoryName: 'Grocery',
            barcodes: [],
          },
          {
            ...baseCandidate,
            candidateId: 1,
            sku: 'NP-1',
            basePrice: null,
            name: 'No Price',
          },
        ]),
      );

      const result = await service.commit('upl-mix', [0, 1], 'tenant-1');

      expect(result.created).toHaveLength(1);
      expect(mockPrisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ categoryId: 'cat-77' }),
        }),
      );
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toMatchObject({
        candidateId: 1,
        reason: 'missing or invalid price',
      });
    });

    it('applies per-candidate overrides so inline edits are persisted', async () => {
      seedCache(
        'tenant-1',
        'upl-edit',
        payloadFor('tenant-1', 'upl-edit', [
          { ...baseCandidate, candidateId: 0, sku: null, barcodes: [] },
        ]),
      );

      const result = await service.commit('upl-edit', [0], 'tenant-1', [
        {
          candidateId: 0,
          name: '  Premium Tea Powder  ',
          sku: ' tea-99 ',
          basePrice: 250,
          unit: 'pack',
        },
      ]);

      expect(result.created).toHaveLength(1);
      const createArgs = mockPrisma.product.create.mock.calls[0]?.[0] as {
        data: {
          name: string;
          sku: string;
          unit: string;
          basePrice: { toString(): string };
        };
      };
      expect(createArgs.data).toMatchObject({
        name: 'Premium Tea Powder',
        sku: 'TEA-99',
        unit: 'pack',
      });
      expect(createArgs.data.basePrice.toString()).toBe('250');
      expect(result.created[0]).toMatchObject({
        name: 'Premium Tea Powder',
        sku: 'TEA-99',
      });
    });

    it('ignores an override for a candidate that was not selected', async () => {
      seedCache(
        'tenant-1',
        'upl-edit-skip',
        payloadFor('tenant-1', 'upl-edit-skip', [
          { ...baseCandidate, candidateId: 0 },
          { ...baseCandidate, candidateId: 1, name: 'Second Row', sku: 'B-1' },
        ]),
      );

      await service.commit('upl-edit-skip', [0], 'tenant-1', [
        { candidateId: 1, name: 'Should not be used' },
      ]);

      expect(mockPrisma.product.create).toHaveBeenCalledTimes(1);
      const createArgs = mockPrisma.product.create.mock.calls[0]?.[0] as {
        data: { name: string };
      };
      expect(createArgs.data.name).toBe('Tea Powder');
    });

    it('skips an override whose name is blank after trimming', async () => {
      seedCache(
        'tenant-1',
        'upl-blank',
        payloadFor('tenant-1', 'upl-blank', [baseCandidate]),
      );

      const result = await service.commit('upl-blank', [0], 'tenant-1', [
        { candidateId: 0, name: '   ', basePrice: 99 },
      ]);

      expect(result.created).toHaveLength(0);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toMatchObject({
        candidateId: 0,
        reason: 'missing name',
      });
    });

    it('skips an override carrying a non-finite or negative price', async () => {
      seedCache(
        'tenant-1',
        'upl-badprice',
        payloadFor('tenant-1', 'upl-badprice', [baseCandidate]),
      );

      const result = await service.commit('upl-badprice', [0], 'tenant-1', [
        { candidateId: 0, basePrice: -5 },
      ]);

      expect(result.created).toHaveLength(0);
      expect(mockPrisma.product.create).not.toHaveBeenCalled();
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toMatchObject({
        candidateId: 0,
        name: 'Tea Powder',
        reason: 'invalid price',
      });
    });

    it('treats a cleared SKU override as "generate one"', async () => {
      seedCache(
        'tenant-1',
        'upl-clearsku',
        payloadFor('tenant-1', 'upl-clearsku', [baseCandidate]),
      );

      await service.commit('upl-clearsku', [0], 'tenant-1', [
        { candidateId: 0, sku: '  ' },
      ]);

      const createArgs = mockPrisma.product.create.mock.calls[0]?.[0] as {
        data: { sku: string };
      };
      expect(createArgs.data.sku).toMatch(/^tea-powder-[0-9A-F]{6}$/);
    });

    it('throws 404 when committing an expired upload', async () => {
      await expect(
        service.commit('gone', [0], 'tenant-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('barcodeTypeFor', () => {
    it('infers ean13 / upc / code128 from length', () => {
      expect(barcodeTypeFor('8801111000015')).toBe('ean13');
      expect(barcodeTypeFor('012345678901')).toBe('upc');
      expect(barcodeTypeFor('12345')).toBe('code128');
    });
  });
});
