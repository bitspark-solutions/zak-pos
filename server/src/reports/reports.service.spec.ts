import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';
import { DatabaseService } from '../database/database.service';
import { defaultRange } from './nl-parser';
import type { ResolvedReportSpec } from './interfaces/reports.interface';

const TENANT = 'tenant-1';

const dec = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

/**
 * Prisma.Sql is a type-only export at runtime — detect the raw-query fragment
 * shape (public .sql/.values) by duck-typing to rebuild readable SQL.
 */
interface SqlFragment {
  sql: string;
  values: readonly unknown[];
}

function asSqlFragment(value: unknown): SqlFragment | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as { sql?: unknown; values?: unknown };
  if (typeof candidate.sql === 'string' && Array.isArray(candidate.values)) {
    return { sql: candidate.sql, values: candidate.values };
  }
  return null;
}

function renderValue(value: unknown): string {
  const fragment = asSqlFragment(value);
  if (fragment === null) {
    return '?';
  }
  const parts = fragment.sql.split('?');
  let out = '';
  parts.forEach((part, index) => {
    out += part;
    if (index < parts.length - 1) {
      out += renderValue(fragment.values[index]);
    }
  });
  return out;
}

/** Rebuild the full raw SQL from a tagged-template $queryRaw call. */
function sqlText(call: unknown[]): string {
  const strings = call[0] as readonly string[];
  let out = '';
  strings.forEach((part, index) => {
    out += part;
    if (index < strings.length - 1) {
      out += renderValue(call[index + 1]);
    }
  });
  return out;
}

describe('ReportsService', () => {
  let service: ReportsService;

  const mockQueryRaw = jest.fn();
  const mockPrisma = {
    $queryRaw: mockQueryRaw,
    shop: { findMany: jest.fn() },
  };

  // Same withTenant double as the receipts spec: run the callback against the
  // mocked transaction client (RLS-scoped path, never admin getPrisma()).
  const mockDatabaseService = {
    withTenant: jest.fn(
      (tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockPrisma),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockQueryRaw.mockResolvedValue([]);
    mockPrisma.shop.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  // -------------------------------------------------------------------------
  // sales-summary
  // -------------------------------------------------------------------------

  describe('getSalesSummary', () => {
    const rawRow = {
      period: '2026-10-01',
      grossSales: dec('1000.50'),
      discount: dec('50.25'),
      tax: dec('100.00'),
      netSales: dec('1050.25'),
      txCount: 3,
    };

    it('converts Decimal rows to plain numbers and sums totals', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        rawRow,
        {
          period: '2026-10-02',
          grossSales: dec('0'),
          discount: dec('0'),
          tax: dec('0'),
          netSales: dec('0'),
          txCount: 0,
        },
      ]);

      const result = await service.getSalesSummary(
        { from: '2026-10-01', to: '2026-10-02' },
        TENANT,
      );

      expect(result).toEqual({
        reportType: 'sales-summary',
        from: '2026-10-01',
        to: '2026-10-02',
        shopId: null,
        groupBy: 'day',
        rows: [
          {
            period: '2026-10-01',
            grossSales: 1000.5,
            discount: 50.25,
            tax: 100,
            netSales: 1050.25,
            txCount: 3,
          },
          {
            period: '2026-10-02',
            grossSales: 0,
            discount: 0,
            tax: 0,
            netSales: 0,
            txCount: 0,
          },
        ],
        totals: {
          grossSales: 1000.5,
          discount: 50.25,
          tax: 100,
          netSales: 1050.25,
          txCount: 3,
        },
      });
      // JSON-safe numbers, not Decimal objects.
      expect(JSON.parse(JSON.stringify(result)).rows[0].grossSales).toBe(
        1000.5,
      );
    });

    it('defaults to the last-30-days window and day grouping', async () => {
      await service.getSalesSummary({}, TENANT);

      const expected = defaultRange(new Date());
      const call = mockQueryRaw.mock.calls[0];
      expect(mockDatabaseService.withTenant).toHaveBeenCalled();
      expect(sqlText(call)).toContain(`to_char(s."createdAt", 'YYYY-MM-DD')`);
      expect(sqlText(call)).toContain(`s."status" = 'completed'`);
      expect(sqlText(call)).toContain('>= ?::date');
      expect(sqlText(call)).toContain("+ INTERVAL '1 day')");
      expect(call).toContainEqual(expected.from);
      expect(call).toContainEqual(expected.to);
      expect(call).toContainEqual(TENANT);
    });

    it('switches the period expression for week and month', async () => {
      await service.getSalesSummary({ groupBy: 'month' }, TENANT);
      expect(sqlText(mockQueryRaw.mock.calls[0])).toContain(
        `to_char(s."createdAt", 'YYYY-MM')`,
      );

      mockQueryRaw.mockClear();
      await service.getSalesSummary({ groupBy: 'week' }, TENANT);
      expect(sqlText(mockQueryRaw.mock.calls[0])).toContain(
        `to_char(date_trunc('week', s."createdAt"), 'IYYY-"W"IW')`,
      );
    });

    it('adds a bound shopId predicate when a shop is selected', async () => {
      const result = await service.getSalesSummary(
        { shopId: 'shop-9' },
        TENANT,
      );
      expect(result.shopId).toBe('shop-9');
      const sql = sqlText(mockQueryRaw.mock.calls[0]);
      expect(sql).toContain(`AND s."shopId" = ?`);
      // The shop id must be a bound parameter, never inlined into the SQL.
      expect(sql).not.toContain('shop-9');
    });

    it('rejects malformed or inverted date ranges with 400', async () => {
      await expect(
        service.getSalesSummary({ from: '01-10-2026' }, TENANT),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.getSalesSummary(
          { from: '2026-10-05', to: '2026-10-01' },
          TENANT,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // top-products
  // -------------------------------------------------------------------------

  describe('getTopProducts', () => {
    it('maps Decimal qty/revenue to numbers and echoes limit/sortBy', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          productId: 'p-1',
          name: 'Tea Powder',
          sku: 'TEA-1',
          qtySold: dec('12.500'),
          revenue: dec('625.00'),
        },
      ]);

      const result = await service.getTopProducts(
        { from: '2026-01-01', to: '2026-01-31', limit: 5, sortBy: 'qty' },
        TENANT,
      );

      expect(result).toEqual({
        reportType: 'top-products',
        from: '2026-01-01',
        to: '2026-01-31',
        shopId: null,
        limit: 5,
        sortBy: 'qty',
        rows: [
          {
            productId: 'p-1',
            name: 'Tea Powder',
            sku: 'TEA-1',
            qtySold: 12.5,
            revenue: 625,
          },
        ],
      });
      // sortBy=qty orders by the qty aggregate first, revenue DESC as tiebreak.
      const sql = sqlText(mockQueryRaw.mock.calls[0]);
      expect(sql).toContain('ORDER BY COALESCE(SUM(sl."qty"), 0) DESC');
      expect(sql).toContain(
        'DESC,\n            COALESCE(SUM(sl."lineTotal"), 0) DESC',
      );
    });

    it('clamps limit into 1..50 and defaults to revenue/10', async () => {
      const high = await service.getTopProducts({ limit: 100 }, TENANT);
      expect(high.limit).toBe(50);
      expect(mockQueryRaw.mock.calls[0]).toContainEqual(50);

      mockQueryRaw.mockClear();
      const low = await service.getTopProducts({ limit: 0 }, TENANT);
      expect(low.limit).toBe(1);

      mockQueryRaw.mockClear();
      const dflt = await service.getTopProducts({}, TENANT);
      expect(dflt).toMatchObject({ limit: 10, sortBy: 'revenue' });
      expect(sqlText(mockQueryRaw.mock.calls[0])).toContain(
        'ORDER BY COALESCE(SUM(sl."lineTotal"), 0) DESC',
      );
    });

    it('joins sale_lines to completed sales only', async () => {
      await service.getTopProducts({}, TENANT);
      const sql = sqlText(mockQueryRaw.mock.calls[0]);
      expect(sql).toContain('FROM sale_lines sl');
      expect(sql).toContain('JOIN sales s ON s."id" = sl."saleId"');
      expect(sql).toContain(`s."status" = 'completed'`);
    });
  });

  // -------------------------------------------------------------------------
  // sales-by-category
  // -------------------------------------------------------------------------

  describe('getSalesByCategory', () => {
    it('left-joins categories and keeps numbers plain', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          categoryId: null,
          categoryName: 'Uncategorized',
          qtySold: dec('4'),
          revenue: dec('120.40'),
        },
        {
          categoryId: 'c-1',
          categoryName: 'Beverages',
          qtySold: dec('10'),
          revenue: dec('1000'),
        },
      ]);

      const result = await service.getSalesByCategory({}, TENANT);

      expect(result).toEqual({
        reportType: 'sales-by-category',
        from: expect.any(String),
        to: expect.any(String),
        shopId: null,
        rows: [
          {
            categoryId: null,
            categoryName: 'Uncategorized',
            qtySold: 4,
            revenue: 120.4,
          },
          {
            categoryId: 'c-1',
            categoryName: 'Beverages',
            qtySold: 10,
            revenue: 1000,
          },
        ],
      });
      const sql = sqlText(mockQueryRaw.mock.calls[0]);
      expect(sql).toContain('LEFT JOIN categories c');
      expect(sql).toContain(`COALESCE(c."name", 'Uncategorized')`);
    });
  });

  // -------------------------------------------------------------------------
  // payment-methods
  // -------------------------------------------------------------------------

  describe('getPaymentMethods', () => {
    it('filters money-in payments of completed sales in range', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        { method: 'cash', count: 7, amount: dec('700.00') },
        { method: 'bKash', count: 2, amount: dec('250.50') },
      ]);

      const result = await service.getPaymentMethods(
        { from: '2026-02-01', to: '2026-02-28', shopId: 'shop-3' },
        TENANT,
      );

      expect(result).toEqual({
        reportType: 'payment-methods',
        from: '2026-02-01',
        to: '2026-02-28',
        shopId: 'shop-3',
        rows: [
          { method: 'cash', count: 7, amount: 700 },
          { method: 'bKash', count: 2, amount: 250.5 },
        ],
      });
      const sql = sqlText(mockQueryRaw.mock.calls[0]);
      expect(sql).toContain(`pm."direction" = 'in'`);
      expect(sql).toContain(`s."status" = 'completed'`);
      expect(sql).toContain('JOIN sales s ON s."id" = pm."saleId"');
      expect(sql).toContain('AND s."shopId" = ?');
      expect(sql).not.toContain('shop-3');
    });
  });

  // -------------------------------------------------------------------------
  // inventory-valuation
  // -------------------------------------------------------------------------

  describe('getInventoryValuation', () => {
    it('scopes via products.tenantId (inventory has none) and totals valuations', async () => {
      mockQueryRaw.mockResolvedValueOnce([
        {
          productId: 'p-1',
          name: 'Tea Powder',
          sku: 'TEA-1',
          shopId: 'shop-1',
          shopName: 'Main Store',
          quantityOnHand: dec('10.000'),
          avgCost: dec('45.50'),
          valuation: dec('455.00'),
        },
        {
          productId: 'p-2',
          name: 'Milk 1L',
          sku: 'MILK-1',
          shopId: 'shop-1',
          shopName: 'Main Store',
          quantityOnHand: dec('2.350'),
          avgCost: dec('30.00'),
          valuation: dec('70.50'),
        },
      ]);

      const result = await service.getInventoryValuation({}, TENANT);

      expect(result).toEqual({
        reportType: 'inventory-valuation',
        shopId: null,
        rows: [
          {
            productId: 'p-1',
            name: 'Tea Powder',
            sku: 'TEA-1',
            shopId: 'shop-1',
            shopName: 'Main Store',
            quantityOnHand: 10,
            avgCost: 45.5,
            valuation: 455,
          },
          {
            productId: 'p-2',
            name: 'Milk 1L',
            sku: 'MILK-1',
            shopId: 'shop-1',
            shopName: 'Main Store',
            quantityOnHand: 2.35,
            avgCost: 30,
            valuation: 70.5,
          },
        ],
        totals: { quantityOnHand: 12.35, valuation: 525.5 },
      });
      const sql = sqlText(mockQueryRaw.mock.calls[0]);
      expect(sql).toContain('FROM inventory i');
      expect(sql).toContain('JOIN products p ON p."id" = i."productId"');
      expect(sql).toContain('WHERE p."tenantId" = ?');
      // No date columns for this report.
      expect(sql).not.toContain('createdAt');
    });

    it('has no date fields and an exact contract envelope shape', async () => {
      const result = await service.getInventoryValuation(
        { shopId: 'shop-1' },
        TENANT,
      );
      expect(Object.keys(result).sort()).toEqual([
        'reportType',
        'rows',
        'shopId',
        'totals',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // envelope shapes & shared plumbing
  // -------------------------------------------------------------------------

  describe('contract envelopes', () => {
    it('sales-summary carries exactly the pinned keys', async () => {
      const result = await service.getSalesSummary({}, TENANT);
      expect(Object.keys(result).sort()).toEqual([
        'from',
        'groupBy',
        'reportType',
        'rows',
        'shopId',
        'to',
        'totals',
      ]);
    });

    it('listTenantShops returns id/name options through withTenant', async () => {
      mockPrisma.shop.findMany.mockResolvedValueOnce([
        { id: 'shop-1', name: 'Main Store' },
      ]);

      const shops = await service.listTenantShops(TENANT);

      expect(shops).toEqual([{ id: 'shop-1', name: 'Main Store' }]);
      expect(mockPrisma.shop.findMany).toHaveBeenCalledWith({
        where: { tenantId: TENANT },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });

    it('buildReport routes each reportType to its resolver', async () => {
      const spec = (
        reportType: ResolvedReportSpec['reportType'],
      ): ResolvedReportSpec => ({
        reportType,
        from: '2026-01-01',
        to: '2026-01-31',
        shopId: null,
        groupBy: 'day',
        limit: 10,
        sortBy: 'revenue',
      });

      expect(
        (await service.buildReport(spec('sales-summary'), TENANT)).reportType,
      ).toBe('sales-summary');
      expect(
        (await service.buildReport(spec('top-products'), TENANT)).reportType,
      ).toBe('top-products');
      expect(
        (await service.buildReport(spec('sales-by-category'), TENANT))
          .reportType,
      ).toBe('sales-by-category');
      expect(
        (await service.buildReport(spec('payment-methods'), TENANT)).reportType,
      ).toBe('payment-methods');
      expect(
        (await service.buildReport(spec('inventory-valuation'), TENANT))
          .reportType,
      ).toBe('inventory-valuation');
      expect(mockQueryRaw).toHaveBeenCalledTimes(5);
    });
  });
});
