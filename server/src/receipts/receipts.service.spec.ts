import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ReceiptsService } from './receipts.service';
import { OcrService } from '../product-import/ocr.service';
import type { OcrReceipt } from '../product-import/ocr.service';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import type { CommitReceiptDto } from './dto/commit-receipt.dto';
import type { ReceiptDraftPayload } from './interfaces/receipts.interface';

const RECEIPT_TTL_SECONDS = 3600;
const TENANT = 'tenant-1';

function receiptFile(): {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
} {
  return {
    originalname: 'invoice.png',
    mimetype: 'image/png',
    buffer: Buffer.from([0]),
  };
}

function ocrReceipt(overrides: Partial<OcrReceipt> = {}): OcrReceipt {
  return {
    vendor: 'Acme Suppliers',
    document_date: '2026-10-01',
    currency: 'BDT',
    subtotal: 999,
    discount: 1,
    tax: 2,
    total: 1000,
    items: [{ name: 'Tea Powder', qty: 2, unit_price: 50, line_total: 100 }],
    raw_text: 'ACME RECEIPT ...',
    engine: 'paddleocr',
    ...overrides,
  };
}

describe('ReceiptsService', () => {
  let service: ReceiptsService;

  // In-memory Redis double: JSON key/value store (mirrors ProductImportService spec).
  let kv: Map<string, unknown>;
  let mockRedis: {
    getJson: jest.Mock;
    setJson: jest.Mock;
    del: jest.Mock;
  };

  const mockPrisma = {
    product: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    barcode: {
      findFirst: jest.fn(),
    },
    supplier: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    shop: {
      findFirst: jest.fn(),
    },
    purchase: {
      create: jest.fn(),
    },
    purchaseLine: {
      create: jest.fn(),
    },
    inventory: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    inventoryMovement: {
      create: jest.fn(),
    },
  };

  const mockDatabaseService = {
    withTenant: jest.fn(
      (tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockPrisma),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.OCR_SERVICE_URL = 'http://ocr.test:58000';

    kv = new Map();
    mockRedis = {
      getJson: jest.fn(async (key: string) =>
        kv.has(key) ? JSON.parse(JSON.stringify(kv.get(key))) : null,
      ),
      setJson: jest.fn(async (key: string, value: unknown) => {
        kv.set(key, value);
      }),
      del: jest.fn(async (key: string) => {
        kv.delete(key);
      }),
    };

    // Neutral defaults: nothing matches, nothing exists.
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.barcode.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.findMany.mockResolvedValue([]);
    mockPrisma.supplier.findFirst.mockResolvedValue(null);
    mockPrisma.supplier.create.mockResolvedValue({ id: 'sup-new' });
    mockPrisma.shop.findFirst.mockResolvedValue({ id: 'shop-1' });
    mockPrisma.purchase.create.mockImplementation(
      async ({
        data,
      }: {
        data: { status: string; total: { toString(): string } };
      }) => ({
        id: 'pur-1',
        status: data.status,
        total: Number(data.total.toString()),
      }),
    );
    mockPrisma.purchaseLine.create.mockResolvedValue({ id: 'pl-1' });
    mockPrisma.inventory.findFirst.mockResolvedValue(null);
    mockPrisma.inventory.update.mockResolvedValue({ id: 'inv-1' });
    mockPrisma.inventory.create.mockResolvedValue({ id: 'inv-1' });
    mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 'mv-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        OcrService,
        { provide: RedisService, useValue: mockRedis },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ReceiptsService>(ReceiptsService);
  });

  function seedDraft(draftId: string, payload: ReceiptDraftPayload): void {
    kv.set(`rdigit:${draftId}`, payload);
  }

  function draftPayload(
    draftId: string,
    tenantId = TENANT,
  ): ReceiptDraftPayload {
    return {
      tenantId,
      draftId,
      vendor: 'Acme Suppliers',
      documentDate: '2026-10-01',
      currency: 'USD',
      subtotal: 999,
      discount: 1,
      tax: 2,
      total: 1000,
      engine: 'paddleocr',
      lines: [
        {
          lineId: 0,
          name: 'Tea Powder',
          qty: 2,
          unitPrice: 50,
          lineTotal: 100,
          matchedProductId: 'p-1',
          matchedProductName: 'Tea Powder',
        },
      ],
      supplierSuggestions: [{ id: 's-1', name: 'Acme Suppliers' }],
      createdAt: new Date().toISOString(),
    };
  }

  function commitDto(
    overrides: Partial<CommitReceiptDto> = {},
  ): CommitReceiptDto {
    return {
      draftId: 'dr-1',
      lines: [{ lineId: 0, productId: 'p-1', qty: 2, unitCost: 50 }],
      ...overrides,
    } as CommitReceiptDto;
  }

  // -------------------------------------------------------------------------
  // digitize
  // -------------------------------------------------------------------------

  describe('digitize', () => {
    it('matches items by exact name, suggests suppliers and caches the draft', async () => {
      jest.spyOn(OcrService.prototype, 'extractReceipt').mockResolvedValue(
        ocrReceipt({
          items: [
            { name: 'Tea Powder', qty: 2, unit_price: 50, line_total: 100 },
          ],
        }),
      );
      // Exact-name product hit on the first findFirst.
      mockPrisma.product.findFirst.mockResolvedValueOnce({
        id: 'p-1',
        name: 'Tea Powder',
      });
      // Supplier suggestions: exact hits first, then contains fills the rest.
      mockPrisma.supplier.findMany
        .mockResolvedValueOnce([{ id: 's-1', name: 'Acme Suppliers' }])
        .mockResolvedValueOnce([{ id: 's-2', name: 'Acme Wholesale Ltd' }]);

      const result = await service.digitize(receiptFile(), TENANT);

      expect(result.lines).toEqual([
        {
          lineId: 0,
          name: 'Tea Powder',
          qty: 2,
          unitPrice: 50,
          lineTotal: 100,
          matchedProductId: 'p-1',
          matchedProductName: 'Tea Powder',
        },
      ]);
      expect(result.supplierSuggestions).toEqual([
        { id: 's-1', name: 'Acme Suppliers' },
        { id: 's-2', name: 'Acme Wholesale Ltd' },
      ]);
      expect(result.vendor).toBe('Acme Suppliers');
      expect(result.documentDate).toBe('2026-10-01');
      expect(result.currency).toBe('BDT');
      expect(result.engine).toBe('paddleocr');
      // Draft cached under rdigit:<uuid> with the 1h TTL.
      expect(result.draftId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(mockRedis.setJson).toHaveBeenCalledWith(
        `rdigit:${result.draftId}`,
        expect.objectContaining({ tenantId: TENANT, draftId: result.draftId }),
        RECEIPT_TTL_SECONDS,
      );
    });

    it('falls back to a case-insensitive contains match when exact/sku/barcode miss', async () => {
      jest.spyOn(OcrService.prototype, 'extractReceipt').mockResolvedValue(
        ocrReceipt({
          items: [
            {
              name: 'loose tea',
              qty: null,
              unit_price: null,
              line_total: null,
            },
          ],
        }),
      );
      // name exact -> null, sku -> null, barcode -> null, contains -> hit.
      mockPrisma.product.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'p-9', name: 'Loose Tea Powder 1kg' });

      const result = await service.digitize(receiptFile(), TENANT);

      expect(result.lines[0]).toMatchObject({
        lineId: 0,
        qty: null,
        unitPrice: null,
        lineTotal: null,
        matchedProductId: 'p-9',
        matchedProductName: 'Loose Tea Powder 1kg',
      });
    });

    it('keeps the line with null match when nothing resembles the item', async () => {
      jest.spyOn(OcrService.prototype, 'extractReceipt').mockResolvedValue(
        ocrReceipt({
          items: [
            { name: 'Mystery Item', qty: 1, unit_price: 5, line_total: 5 },
          ],
        }),
      );

      const result = await service.digitize(receiptFile(), TENANT);

      expect(result.lines[0]).toMatchObject({
        matchedProductId: null,
        matchedProductName: null,
      });
    });

    it('returns no supplier suggestions when the vendor is null', async () => {
      jest
        .spyOn(OcrService.prototype, 'extractReceipt')
        .mockResolvedValue(ocrReceipt({ vendor: null }));

      const result = await service.digitize(receiptFile(), TENANT);

      expect(result.supplierSuggestions).toEqual([]);
      expect(result.vendor).toBeNull();
      expect(mockPrisma.supplier.findMany).not.toHaveBeenCalled();
    });

    it('throws 503 when the OCR service is not configured', async () => {
      delete process.env.OCR_SERVICE_URL;

      await expect(
        service.digitize(receiptFile(), TENANT),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(mockDatabaseService.withTenant).not.toHaveBeenCalled();
    });

    it('re-reads the cached draft via getDraft (and hides tenant/createdAt)', async () => {
      seedDraft('dr-1', draftPayload('dr-1'));

      const result = await service.getDraft('dr-1', TENANT);

      expect(result.draftId).toBe('dr-1');
      expect(result.lines).toHaveLength(1);
      expect(result.supplierSuggestions).toEqual([
        { id: 's-1', name: 'Acme Suppliers' },
      ]);
      const draft = result as unknown as Record<string, unknown>;
      expect(draft['tenantId']).toBeUndefined();
      expect(draft['createdAt']).toBeUndefined();
    });

    it('404s when the draft expired or belongs to another tenant', async () => {
      await expect(service.getDraft('gone', TENANT)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      seedDraft('dr-x', draftPayload('dr-x', 'tenant-2'));
      await expect(service.getDraft('dr-x', TENANT)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lists tenant suppliers ordered by name', async () => {
      mockPrisma.supplier.findMany.mockResolvedValueOnce([
        { id: 's-1', name: 'Acme' },
        { id: 's-2', name: 'Zen Foods' },
      ]);

      const result = await service.listSuppliers(TENANT);

      expect(result).toEqual([
        { id: 's-1', name: 'Acme' },
        { id: 's-2', name: 'Zen Foods' },
      ]);
      expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // commit
  // -------------------------------------------------------------------------

  describe('commit', () => {
    beforeEach(() => {
      seedDraft('dr-1', draftPayload('dr-1'));
      mockPrisma.product.findMany.mockResolvedValue([{ id: 'p-1' }]);
      mockPrisma.supplier.findFirst.mockResolvedValue({ id: 's-1' });
    });

    function purchaseCreateData(): Record<string, unknown> {
      const call = mockPrisma.purchase.create.mock.calls[0]?.[0] as {
        data: Record<string, unknown>;
      };
      return call.data;
    }

    it('resolves an existing supplier and creates a draft purchase (BDT fallback suppressed by draft currency)', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValueOnce({ id: 's-1' });

      const result = await service.commit(
        commitDto({ supplierId: 's-1' }),
        TENANT,
        { shopId: 'shop-9' },
      );

      expect(result).toEqual({
        purchaseId: 'pur-1',
        status: 'draft',
        linesCreated: 1,
        total: 100,
      });
      const data = purchaseCreateData();
      expect(data).toMatchObject({
        shopId: 'shop-9',
        supplierId: 's-1',
        status: 'draft',
        currency: 'USD',
      });
      expect((data['discount'] as { toString(): string }).toString()).toBe('0');
      // Draft consumed.
      expect(mockRedis.del).toHaveBeenCalledWith('rdigit:dr-1');
      expect(mockPrisma.supplier.create).not.toHaveBeenCalled();
    });

    it('falls back to the tenant oldest shop when the token has no shopId claim', async () => {
      await service.commit(commitDto({ supplierId: 's-1' }), TENANT, {});

      expect(mockPrisma.shop.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: TENANT } }),
      );
      expect(purchaseCreateData()).toMatchObject({ shopId: 'shop-1' });
    });

    it('400s when the supplierId does not belong to the tenant', async () => {
      mockPrisma.supplier.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.commit(commitDto({ supplierId: 'ghost' }), TENANT, {
          shopId: 'shop-9',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled();
    });

    it('creates a supplier from newSupplierName when no supplierId is given', async () => {
      await service.commit(
        commitDto({ supplierId: undefined, newSupplierName: '  New Co  ' }),
        TENANT,
        { shopId: 'shop-9' },
      );

      expect(mockPrisma.supplier.create).toHaveBeenCalledWith({
        data: { tenantId: TENANT, name: 'New Co' },
        select: { id: true },
      });
      expect(purchaseCreateData()).toMatchObject({ supplierId: 'sup-new' });
    });

    it('400s when neither supplierId nor newSupplierName is supplied', async () => {
      await expect(
        service.commit(commitDto({ newSupplierName: '   ' }), TENANT, {
          shopId: 'shop-9',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled();
    });

    it('400s naming the offending line when a productId is outside tenant scope', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([]);

      await expect(
        service.commit(
          commitDto({
            supplierId: 's-1',
            lines: [{ lineId: 3, productId: 'p-bad', qty: 1, unitCost: 5 }],
          }),
          TENANT,
          { shopId: 'shop-9' },
        ),
      ).rejects.toThrow(/Line 3: product p-bad not found/);
      expect(mockPrisma.purchase.create).not.toHaveBeenCalled();
    });

    it('recomputes amounts server-side, clamps discount and applies tax', async () => {
      await service.commit(
        commitDto({
          supplierId: 's-1',
          discount: 200,
          tax: 10,
          lines: [
            { lineId: 0, productId: 'p-1', qty: 2, unitCost: 50 },
            { lineId: 1, productId: 'p-1', qty: 1, unitCost: 30 },
          ],
        }),
        TENANT,
        { shopId: 'shop-9' },
      );

      const data = purchaseCreateData();
      const dec = (key: string): string =>
        (data[key] as { toString(): string }).toString();
      // subtotal 130 from the confirmed lines — the OCR draft amounts (999/1/2/1000) are ignored.
      expect(dec('subtotal')).toBe('130');
      expect(dec('discount')).toBe('130'); // 200 clamped to subtotal
      expect(dec('tax')).toBe('10');
      expect(dec('total')).toBe('10'); // 130 - 130 + 10
      expect(mockPrisma.purchaseLine.create).toHaveBeenCalledTimes(2);
      const firstLine = mockPrisma.purchaseLine.create.mock.calls[0]?.[0] as {
        data: { lineTotal: { toString(): string } };
      };
      expect(firstLine.data.lineTotal.toString()).toBe('100');
    });

    it('restocks and writes purchase movements when receive is true', async () => {
      mockPrisma.inventory.findFirst.mockResolvedValueOnce({
        id: 'inv-1',
        quantityOnHand: 5,
        avgCost: 40,
      });

      const result = await service.commit(
        commitDto({ supplierId: 's-1', receive: true }),
        TENANT,
        { shopId: 'shop-9' },
      );

      expect(result.status).toBe('received');
      expect(purchaseCreateData()).toMatchObject({ status: 'received' });
      const updateCall = mockPrisma.inventory.update.mock
        .calls[0] as unknown as [
        {
          where: { id: string };
          data: { quantityOnHand: number; avgCost: number };
        },
      ];
      expect(updateCall[0].where.id).toBe('inv-1');
      expect(updateCall[0].data.quantityOnHand).toBe(7);
      // WAVC: (40*5 + 50*2) / 7 — purchase cost feeds average cost
      expect(updateCall[0].data.avgCost).toBeCloseTo(300 / 7, 6);
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT,
          shopId: 'shop-9',
          productId: 'p-1',
          variantId: null,
          movementType: 'IN',
          quantity: 2,
          unitCost: 50,
          referenceType: 'purchase',
          referenceId: 'pur-1',
        },
      });
    });

    it('creates an inventory row when receiving a product without one, and never restocks on draft', async () => {
      await service.commit(commitDto({ supplierId: 's-1' }), TENANT, {
        shopId: 'shop-9',
      });
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
      expect(mockPrisma.inventory.create).not.toHaveBeenCalled();

      mockPrisma.inventory.findFirst.mockResolvedValueOnce(null);
      seedDraft('dr-1', draftPayload('dr-1')); // re-seed: first commit consumed it
      await service.commit(
        commitDto({ supplierId: 's-1', receive: true, draftId: 'dr-1' }),
        TENANT,
        { shopId: 'shop-9' },
      );
      expect(mockPrisma.inventory.update).not.toHaveBeenCalled();
      expect(mockPrisma.inventory.create).toHaveBeenCalledWith({
        data: {
          shopId: 'shop-9',
          productId: 'p-1',
          variantId: null,
          quantityOnHand: 2,
          avgCost: 50,
        },
      });
      expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
        data: {
          tenantId: TENANT,
          shopId: 'shop-9',
          productId: 'p-1',
          variantId: null,
          movementType: 'IN',
          quantity: 2,
          unitCost: 50,
          referenceType: 'purchase',
          referenceId: 'pur-1',
        },
      });
    });

    it('persists a parsed dueDate and rejects invalid dates with 400', async () => {
      await service.commit(
        commitDto({ supplierId: 's-1', date: '2026-10-15' }),
        TENANT,
        { shopId: 'shop-9' },
      );
      const data = purchaseCreateData();
      expect(data['dueDate']).toBeInstanceOf(Date);
      expect((data['dueDate'] as Date).toISOString().slice(0, 10)).toBe(
        '2026-10-15',
      );

      seedDraft('dr-1', draftPayload('dr-1')); // re-seed: the commit above consumed the draft
      await expect(
        service.commit(
          commitDto({ supplierId: 's-1', date: 'not-a-date' }),
          TENANT,
          { shopId: 'shop-9' },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s on an expired draft before touching the database', async () => {
      await expect(
        service.commit(commitDto({ draftId: 'gone' }), TENANT, {
          shopId: 'shop-9',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(mockDatabaseService.withTenant).not.toHaveBeenCalled();
    });
  });
});
