import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ForecastService } from './forecast.service';
import { DatabaseService } from '../database/database.service';
import { addIsoDays, formatDateOnly } from './forecast-math';

const TENANT = 'tenant-1';

const dec = (value: string): Prisma.Decimal => new Prisma.Decimal(value);

/**
 * Prisma.Sql is a type-only export at runtime — detect the raw-query fragment
 * shape (public .sql/.values) by duck-typing to rebuild readable SQL.
 * (Same helper set as the reports spec.)
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

/** All bound parameter values of a tagged-template call, fragments flattened. */
function boundValues(call: unknown[]): unknown[] {
  const values: unknown[] = [];
  for (const value of call) {
    const fragment = asSqlFragment(value);
    if (fragment === null) {
      values.push(value);
    } else {
      values.push(...fragment.values);
    }
  }
  return values;
}

/** Fixtures routed per query shape. */
interface FakeRows {
  demand?: unknown[];
  daily?: unknown[];
  stock?: unknown[];
  products?: unknown[];
}

describe('ForecastService', () => {
  let service: ForecastService;

  const mockQueryRaw = jest.fn();
  const mockPrisma = { $queryRaw: mockQueryRaw };

  // Same withTenant double as the reports spec: run the callback against the
  // mocked transaction client (RLS-scoped path, never admin getPrisma()).
  const mockDatabaseService = {
    withTenant: jest.fn(
      (tenantId: string, fn: (tx: unknown) => Promise<unknown>) =>
        fn(mockPrisma),
    ),
  };

  /** Route each tagged query to its fixture by scanning the SQL text. */
  function routeRows(rows: FakeRows): void {
    mockQueryRaw.mockImplementation((strings: readonly string[]) => {
      const text = strings.join(' ');
      if (text.includes('FROM sale_lines')) {
        return Promise.resolve(rows.demand ?? rows.daily ?? []);
      }
      if (text.includes('FROM inventory')) {
        return Promise.resolve(rows.stock ?? []);
      }
      return Promise.resolve(rows.products ?? []);
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    routeRows({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForecastService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ForecastService>(ForecastService);
  });

  // -------------------------------------------------------------------------
  // GET /forecast (list)
  // -------------------------------------------------------------------------

  describe('getForecast', () => {
    /**
     * Tea Powder : last28=14, prev=0 -> avg 0.35, stock 3.5,
     *   forecast 4.9, cover 10 -> out_of_stock, order ceil(5.88-3.5)=3.
     * Alpha widgets: last28=84 -> avg 2.1, stock 0, forecast 29.4,
     *   cover 0 -> out_of_stock, order ceil(35.28-0)=36.
     * Zinc Stock: demand 0 (stock-only candidate), stock 1000 ->
     *   avg 0 -> cover null -> ok, order 0.
     */
    const listRows: FakeRows = {
      demand: [
        { productId: 'p-tea', last28Qty: dec('14'), prev28Qty: dec('0') },
        { productId: 'p-alpha', last28Qty: dec('84'), prev28Qty: dec('0') },
      ],
      stock: [
        { productId: 'p-tea', stock: dec('3.500') },
        { productId: 'p-zinc', stock: dec('1000.000') },
      ],
      products: [
        { id: 'p-tea', name: 'Tea Powder', sku: 'TEA-1', unit: 'pcs' },
        { id: 'p-alpha', name: 'Alpha widgets', sku: 'ALW-1', unit: 'box' },
        { id: 'p-zinc', name: 'Zinc Stock', sku: 'ZNC-1', unit: 'kg' },
      ],
    };

    it('converts Decimal rows to plain JSON numbers with pinned dp', async () => {
      routeRows(listRows);

      const result = await service.getForecast({}, TENANT);

      expect(result.horizonDays).toBe(14);
      expect(result.shopId).toBeNull();
      expect(Number.isFinite(Date.parse(result.generatedAt))).toBe(true);
      expect(result.rows).toEqual([
        {
          productId: 'p-alpha',
          name: 'Alpha widgets',
          sku: 'ALW-1',
          unit: 'box',
          avgDailyQty: 2.1,
          forecastQty: 29.4,
          currentStock: 0,
          daysOfCover: 0,
          risk: 'out_of_stock',
          suggestedOrderQty: 36,
        },
        {
          productId: 'p-tea',
          name: 'Tea Powder',
          sku: 'TEA-1',
          unit: 'pcs',
          avgDailyQty: 0.35,
          forecastQty: 4.9,
          currentStock: 3.5,
          daysOfCover: 10,
          risk: 'out_of_stock',
          suggestedOrderQty: 3,
        },
        {
          productId: 'p-zinc',
          name: 'Zinc Stock',
          sku: 'ZNC-1',
          unit: 'kg',
          avgDailyQty: 0,
          forecastQty: 0,
          currentStock: 1000,
          daysOfCover: null,
          risk: 'ok',
          suggestedOrderQty: 0,
        },
      ]);
      // JSON-safe numbers, not Decimal objects.
      expect(JSON.parse(JSON.stringify(result)).rows[1].avgDailyQty).toBe(0.35);
    });

    it('orders daysOfCover ASC with NULLs last, then name ASC', async () => {
      routeRows(listRows);

      const result = await service.getForecast({}, TENANT);
      const covers = result.rows.map((row) => row.daysOfCover);
      expect(covers).toEqual([0, 10, null]);
    });

    it('computes totals BEFORE the risk filter, then filters rows', async () => {
      routeRows(listRows);

      const result = await service.getForecast({ risk: 'low' }, TENANT);

      expect(result.totals).toEqual({ products: 3, outOfStock: 2, low: 0 });
      expect(result.rows).toEqual([]);
    });

    it('keeps only matching-risk rows when a risk filter is given', async () => {
      routeRows(listRows);

      const result = await service.getForecast({ risk: 'ok' }, TENANT);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].productId).toBe('p-zinc');
      expect(result.totals.products).toBe(3);
    });

    it('clamps horizonDays to 3..90 without rejecting', async () => {
      routeRows(listRows);

      expect(
        (await service.getForecast({ horizonDays: 1 }, TENANT)).horizonDays,
      ).toBe(3);
      expect(
        (await service.getForecast({ horizonDays: 500 }, TENANT)).horizonDays,
      ).toBe(90);
      // horizon feeds forecastQty/risk classification, never the SQL.
      const tight = await service.getForecast({ horizonDays: 4 }, TENANT);
      expect(tight.rows[1].forecastQty).toBe(1.4); // 0.35 * 4
      expect(tight.rows[1].risk).toBe('ok'); // cover 10 >= 4, >= 8, <= 32
      expect(tight.rows[1].suggestedOrderQty).toBe(0);
    });

    it('scopes both queries to completed sales in the 56-day window', async () => {
      routeRows(listRows);

      await service.getForecast({}, TENANT);

      const demandSql = sqlText(mockQueryRaw.mock.calls[0]);
      const stockSql = sqlText(mockQueryRaw.mock.calls[1]);
      expect(demandSql).toContain('FROM sale_lines sl');
      expect(demandSql).toContain('JOIN sales s ON s."id" = sl."saleId"');
      expect(demandSql).toContain(`s."status" = 'completed'`);
      expect(demandSql).toContain('>= ?::date');
      expect(demandSql).toContain("+ INTERVAL '1 day')");
      // Inventory has no tenantId column — scope via the products join.
      expect(stockSql).toContain('FROM inventory i');
      expect(stockSql).toContain('JOIN products p ON p."id" = i."productId"');
      expect(stockSql).toContain('WHERE p."tenantId" = ?');
      expect(mockQueryRaw.mock.calls[0]).toContainEqual(TENANT);
    });

    it('binds window boundary dates relative to today as parameters', async () => {
      routeRows(listRows);

      await service.getForecast({}, TENANT);

      const today = formatDateOnly(new Date());
      const lastStart = addIsoDays(today, -27);
      const call = mockQueryRaw.mock.calls[0];
      expect(call).toContainEqual(lastStart);
      expect(call).toContainEqual(addIsoDays(lastStart, -28));
      expect(call).toContainEqual(today);
    });

    it('adds bound shopId predicates to history AND stock when selected', async () => {
      routeRows(listRows);

      const result = await service.getForecast({ shopId: 'shop-9' }, TENANT);

      expect(result.shopId).toBe('shop-9');
      const demandSql = sqlText(mockQueryRaw.mock.calls[0]);
      const stockSql = sqlText(mockQueryRaw.mock.calls[1]);
      expect(demandSql).toContain('AND s."shopId" = ?');
      expect(stockSql).toContain('AND i."shopId" = ?');
      // The shop id must be a bound parameter, never inlined into the SQL.
      expect(demandSql).not.toContain('shop-9');
      expect(boundValues(mockQueryRaw.mock.calls[0])).toContain('shop-9');
      expect(boundValues(mockQueryRaw.mock.calls[1])).toContain('shop-9');
    });

    it('searches name/sku case-insensitively with a bound ILIKE pattern', async () => {
      routeRows(listRows);

      await service.getForecast({ search: 'tea' }, TENANT);

      const productsSql = sqlText(mockQueryRaw.mock.calls[2]);
      expect(productsSql).toContain('ILIKE');
      expect(productsSql).not.toContain('tea');
      expect(boundValues(mockQueryRaw.mock.calls[2])).toContain('%tea%');
    });

    it('restricts the catalog query to active candidates with demand or stock', async () => {
      routeRows({
        demand: [
          { productId: 'p-a', last28Qty: dec('1'), prev28Qty: dec('0') },
        ],
        stock: [
          { productId: 'p-b', stock: dec('5') },
          { productId: 'p-zero', stock: dec('0') }, // no demand, no stock
        ],
        products: [{ id: 'p-a', name: 'A', sku: 'A', unit: 'pcs' }],
      });

      const result = await service.getForecast({}, TENANT);

      expect(result.totals.products).toBe(1);
      const call = mockQueryRaw.mock.calls[2];
      const values = boundValues(call);
      expect(values).toContain('p-a');
      expect(values).toContain('p-b');
      expect(values).not.toContain('p-zero');
      const sql = sqlText(call);
      expect(sql).toContain('p."isActive" = true');
    });

    it('returns an empty envelope without a catalog query when no candidates', async () => {
      routeRows({ demand: [], stock: [], products: [] });

      const result = await service.getForecast({}, TENANT);

      expect(result).toEqual({
        horizonDays: 14,
        shopId: null,
        generatedAt: expect.any(String),
        rows: [],
        totals: { products: 0, outOfStock: 0, low: 0 },
      });
      expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    });

    it('carries exactly the pinned envelope keys', async () => {
      routeRows(listRows);

      const result = await service.getForecast({}, TENANT);

      expect(Object.keys(result).sort()).toEqual([
        'generatedAt',
        'horizonDays',
        'rows',
        'shopId',
        'totals',
      ]);
      expect(Object.keys(result.rows[0]).sort()).toEqual([
        'avgDailyQty',
        'currentStock',
        'daysOfCover',
        'forecastQty',
        'name',
        'productId',
        'risk',
        'sku',
        'suggestedOrderQty',
        'unit',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // GET /forecast/product/:productId (detail)
  // -------------------------------------------------------------------------

  describe('getProductForecast', () => {
    const productRow = [
      { id: 'p-tea', name: 'Tea Powder', sku: 'TEA-1', unit: 'pcs' },
    ];

    /** daily rows keyed to today so both halves are exercised. */
    function dailyFixture(): FakeRows {
      const today = formatDateOnly(new Date());
      return {
        daily: [
          { day: today, qty: dec('2') }, // recent half
          { day: addIsoDays(today, -28), qty: dec('28') }, // previous half
        ],
        stock: [{ productId: 'p-tea', stock: dec('7') }],
        products: productRow,
      };
    }

    it('throws NotFoundException when the product is unknown to the tenant', async () => {
      routeRows({ products: [] });

      await expect(
        service.getProductForecast('p-nope', {}, TENANT),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps metrics from Decimal daily/stock rows to plain numbers', async () => {
      routeRows(dailyFixture());

      const result = await service.getProductForecast('p-tea', {}, TENANT);

      // last28=2, prev28=28 -> avg = 0.7*2/28 + 0.3*28/28 = 0.05+0.3 = 0.35
      expect(result).toMatchObject({
        productId: 'p-tea',
        name: 'Tea Powder',
        sku: 'TEA-1',
        unit: 'pcs',
        avgDailyQty: 0.35,
        forecastQty: 4.9,
        currentStock: 7,
        daysOfCover: 20,
        risk: 'low',
        suggestedOrderQty: 0, // ceil(5.88 - 7) floors at 0
      });
      expect(JSON.parse(JSON.stringify(result)).currentStock).toBe(7);
    });

    it('zero-fills the 28-day history ending today', async () => {
      routeRows(dailyFixture());

      const today = formatDateOnly(new Date());
      const result = await service.getProductForecast('p-tea', {}, TENANT);

      expect(result.history).toHaveLength(28);
      expect(result.history[0].date).toBe(addIsoDays(today, -27));
      expect(result.history[27]).toEqual({ date: today, qtySold: 2 });
      expect(result.history[1].qtySold).toBe(0);
      // The previous-half day sits outside the visible history window.
      expect(
        result.history.some((p) => p.date === addIsoDays(today, -28)),
      ).toBe(false);
    });

    it('emits a flat forecast series starting tomorrow', async () => {
      routeRows(dailyFixture());

      const today = formatDateOnly(new Date());
      const result = await service.getProductForecast(
        'p-tea',
        { horizonDays: 20 },
        TENANT,
      );

      expect(result.forecastSeries).toHaveLength(20);
      expect(result.forecastSeries[0]).toEqual({
        date: addIsoDays(today, 1),
        expectedQty: 0.35,
      });
      expect(result.forecastSeries[19].date).toBe(addIsoDays(today, 20));
    });

    it('clamps the detail horizon to 3..90', async () => {
      routeRows(dailyFixture());

      const low = await service.getProductForecast(
        'p-tea',
        { horizonDays: 0 },
        TENANT,
      );
      expect(low.forecastSeries).toHaveLength(3);

      const high = await service.getProductForecast(
        'p-tea',
        { horizonDays: 999 },
        TENANT,
      );
      expect(high.forecastSeries).toHaveLength(90);
    });

    it('queries tenant-wide without any shopId clause', async () => {
      routeRows(dailyFixture());

      await service.getProductForecast('p-tea', {}, TENANT);

      for (const call of mockQueryRaw.mock.calls) {
        expect(sqlText(call)).not.toContain('shopId');
      }
      expect(mockQueryRaw).toHaveBeenCalledTimes(3);
      const dailySql = sqlText(mockQueryRaw.mock.calls[1]);
      expect(dailySql).toContain(`s."status" = 'completed'`);
      expect(dailySql).toContain(`to_char(s."createdAt", 'YYYY-MM-DD')`);
      expect(mockQueryRaw.mock.calls[0]).toContainEqual('p-tea');
      expect(mockQueryRaw.mock.calls[0]).toContainEqual(TENANT);
    });

    it('treats zero stock and zero demand as ok with null cover', async () => {
      routeRows({
        daily: [],
        stock: [],
        products: productRow,
      });

      const result = await service.getProductForecast('p-tea', {}, TENANT);

      expect(result.currentStock).toBe(0);
      expect(result.daysOfCover).toBeNull();
      expect(result.risk).toBe('ok');
      expect(result.suggestedOrderQty).toBe(0);
    });
  });
});
