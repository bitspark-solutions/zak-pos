import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import {
  buildForecastSeries,
  clampHorizonDays,
  classifyRisk,
  computeAvgDailyQty,
  computeDemandWindows,
  computeDaysOfCover,
  computeForecastQty,
  escapeLikePattern,
  formatDateOnly,
  roundTo,
  suggestedOrder,
  zeroFilledHistory,
} from './forecast-math';
import type {
  ForecastHistoryPoint,
  ForecastListResponse,
  ForecastQuery,
  ForecastRow,
  ForecastSeriesPoint,
  ProductForecastQuery,
  ProductForecastResponse,
} from './interfaces/forecast.interface';

/**
 * Raw-SQL row shapes. `$queryRaw` hands qty columns back as Decimal.js
 * objects (Prisma.Decimal); every one is converted to a plain number before
 * it reaches the response envelope.
 */
interface DemandRawRow {
  productId: string;
  last28Qty: Prisma.Decimal;
  prev28Qty: Prisma.Decimal;
}

interface StockRawRow {
  productId: string;
  stock: Prisma.Decimal;
}

interface ProductRawRow {
  id: string;
  name: string;
  sku: string;
  unit: string;
}

interface DailyDemandRawRow {
  day: string;
  qty: Prisma.Decimal;
}

const STOCK_DECIMALS = 3;

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

/**
 * Phase F stock forecasting: weighted demand from the last 56 days of
 * completed sales against current stock, over two read-only endpoints.
 * ALL reads run through `databaseService.withTenant` (DB-enforced RLS via
 * `app.tenant_id`); the admin `getPrisma()` client is never used here.
 * Aggregations use raw SQL tagged templates only — every user value is a
 * bound parameter, never string-concatenated.
 *
 * NOTE: `inventory` has NO tenantId column — it is scoped by joining
 * products (p."tenantId" = bound tenant), the same approach as the reports
 * inventory-valuation endpoint.
 */
@Injectable()
export class ForecastService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // 1. GET /forecast
  // ---------------------------------------------------------------------------

  async getForecast(
    query: ForecastQuery,
    tenantId: string,
  ): Promise<ForecastListResponse> {
    const horizonDays = clampHorizonDays(query.horizonDays);
    const shopId = this.normalizeShopId(query.shopId);
    const search = this.normalizeSearch(query.search);
    const windows = computeDemandWindows(formatDateOnly(new Date()));

    const [demandRows, stockRows] = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        Promise.all([
          tx.$queryRaw<DemandRawRow[]>`
            SELECT sl."productId" AS "productId",
              COALESCE(SUM(CASE
                WHEN s."createdAt" >= ${windows.lastStart}::date
                THEN sl."qty" ELSE 0 END), 0) AS "last28Qty",
              COALESCE(SUM(CASE
                WHEN s."createdAt" < ${windows.lastStart}::date
                THEN sl."qty" ELSE 0 END), 0) AS "prev28Qty"
            FROM sale_lines sl
            JOIN sales s ON s."id" = sl."saleId"
            WHERE sl."tenantId" = ${tenantId}
              AND s."status" = 'completed'
              AND s."createdAt" >= ${windows.windowStart}::date
              AND s."createdAt" < (${windows.today}::date + INTERVAL '1 day')
              ${this.shopClause(shopId, 's')}
            GROUP BY sl."productId"`,
          tx.$queryRaw<StockRawRow[]>`
            SELECT i."productId" AS "productId",
              COALESCE(SUM(i."quantityOnHand"), 0) AS stock
            FROM inventory i
            JOIN products p ON p."id" = i."productId"
            WHERE p."tenantId" = ${tenantId}
              ${this.shopClause(shopId, 'i')}
            GROUP BY i."productId"`,
        ]),
    );

    const demand = new Map(
      demandRows.map((row) => [
        row.productId,
        {
          last28Qty: toNumber(row.last28Qty),
          prev28Qty: toNumber(row.prev28Qty),
        },
      ]),
    );
    const stock = new Map(
      stockRows.map((row) => [row.productId, toNumber(row.stock)]),
    );

    // Candidates: any demand in the 56-day window OR stock on hand.
    const candidateIds = [
      ...new Set([
        ...demand.keys(),
        ...[...stock.entries()]
          .filter(([, quantity]) => quantity > 0)
          .map(([productId]) => productId),
      ]),
    ].sort();
    if (candidateIds.length === 0) {
      return {
        horizonDays,
        shopId,
        generatedAt: new Date().toISOString(),
        rows: [],
        totals: { products: 0, outOfStock: 0, low: 0 },
      };
    }

    const products = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<ProductRawRow[]>`
        SELECT p."id" AS id, p."name" AS name, p."sku" AS sku, p."unit" AS unit
        FROM products p
        WHERE p."tenantId" = ${tenantId}
          AND p."isActive" = true
          AND p."id" IN (${Prisma.join(candidateIds)})
          ${this.searchClause(search)}`,
    );

    const rows = products
      .map((product): ForecastRow => {
        const demandRow = demand.get(product.id) ?? {
          last28Qty: 0,
          prev28Qty: 0,
        };
        const avgDailyQty = computeAvgDailyQty(
          demandRow.last28Qty,
          demandRow.prev28Qty,
        );
        const currentStock = roundTo(
          stock.get(product.id) ?? 0,
          STOCK_DECIMALS,
        );
        const forecastQty = computeForecastQty(avgDailyQty, horizonDays);
        const daysOfCover = computeDaysOfCover(currentStock, avgDailyQty);
        const risk = classifyRisk(
          daysOfCover,
          currentStock,
          avgDailyQty,
          horizonDays,
        );
        return {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          avgDailyQty,
          forecastQty,
          currentStock,
          daysOfCover,
          risk,
          suggestedOrderQty: suggestedOrder(risk, forecastQty, currentStock),
        };
      })
      .sort(compareRows);

    // Totals are pinned to the pre-risk-filter candidate set.
    const totals = {
      products: rows.length,
      outOfStock: rows.filter((row) => row.risk === 'out_of_stock').length,
      low: rows.filter((row) => row.risk === 'low').length,
    };
    const filtered = query.risk
      ? rows.filter((row) => row.risk === query.risk)
      : rows;

    return {
      horizonDays,
      shopId,
      generatedAt: new Date().toISOString(),
      rows: filtered,
      totals,
    };
  }

  // ---------------------------------------------------------------------------
  // 2. GET /forecast/product/:productId (tenant-wide, ignores shopId)
  // ---------------------------------------------------------------------------

  async getProductForecast(
    productId: string,
    query: ProductForecastQuery,
    tenantId: string,
  ): Promise<ProductForecastResponse> {
    const horizonDays = clampHorizonDays(query.horizonDays);
    const windows = computeDemandWindows(formatDateOnly(new Date()));

    const [products, dailyRows, stockRows] =
      await this.databaseService.withTenant(tenantId, (tx) =>
        Promise.all([
          tx.$queryRaw<ProductRawRow[]>`
            SELECT p."id" AS id, p."name" AS name, p."sku" AS sku,
              p."unit" AS unit
            FROM products p
            WHERE p."id" = ${productId}
              AND p."tenantId" = ${tenantId}`,
          tx.$queryRaw<DailyDemandRawRow[]>`
            SELECT to_char(s."createdAt", 'YYYY-MM-DD') AS day,
              COALESCE(SUM(sl."qty"), 0) AS qty
            FROM sale_lines sl
            JOIN sales s ON s."id" = sl."saleId"
            WHERE sl."tenantId" = ${tenantId}
              AND sl."productId" = ${productId}
              AND s."status" = 'completed'
              AND s."createdAt" >= ${windows.windowStart}::date
              AND s."createdAt" < (${windows.today}::date + INTERVAL '1 day')
            GROUP BY 1
            ORDER BY 1 ASC`,
          tx.$queryRaw<StockRawRow[]>`
            SELECT i."productId" AS "productId",
              COALESCE(SUM(i."quantityOnHand"), 0) AS stock
            FROM inventory i
            JOIN products p ON p."id" = i."productId"
            WHERE p."tenantId" = ${tenantId}
              AND i."productId" = ${productId}
            GROUP BY i."productId"`,
        ]),
      );

    const product = products[0];
    if (product === undefined) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    let last28Qty = 0;
    let prev28Qty = 0;
    const historyPoints: ForecastHistoryPoint[] = [];
    for (const row of dailyRows) {
      const qty = toNumber(row.qty);
      if (row.day >= windows.lastStart) {
        last28Qty += qty;
      } else {
        prev28Qty += qty;
      }
      historyPoints.push({ date: row.day, qtySold: qty });
    }

    const avgDailyQty = computeAvgDailyQty(last28Qty, prev28Qty);
    const currentStock = roundTo(
      toNumber(stockRows[0]?.stock ?? new Prisma.Decimal(0)),
      STOCK_DECIMALS,
    );
    const forecastQty = computeForecastQty(avgDailyQty, horizonDays);
    const daysOfCover = computeDaysOfCover(currentStock, avgDailyQty);
    const risk = classifyRisk(
      daysOfCover,
      currentStock,
      avgDailyQty,
      horizonDays,
    );
    const forecastSeries: ForecastSeriesPoint[] = buildForecastSeries(
      avgDailyQty,
      horizonDays,
      windows.today,
    );

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      avgDailyQty,
      forecastQty,
      currentStock,
      daysOfCover,
      risk,
      suggestedOrderQty: suggestedOrder(risk, forecastQty, currentStock),
      history: zeroFilledHistory(historyPoints, windows.today),
      forecastSeries,
    };
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  private normalizeShopId(shopId: string | undefined): string | null {
    const trimmed = (shopId ?? '').trim();
    return trimmed === '' ? null : trimmed;
  }

  private normalizeSearch(search: string | undefined): string | null {
    const trimmed = (search ?? '').trim();
    return trimmed === '' ? null : trimmed;
  }

  /**
   * Optional shop predicate as a typed SQL fragment — bound parameter only.
   * `shopId === null` means "all shops of the tenant" (RLS still constrains
   * the tenant, so no shop clause is emitted).
   */
  private shopClause(shopId: string | null, alias: string): Prisma.Sql {
    return shopId === null
      ? Prisma.empty
      : Prisma.sql`AND ${Prisma.raw(alias)}."shopId" = ${shopId}`;
  }

  /** Case-insensitive substring on product name OR sku, always bound. */
  private searchClause(search: string | null): Prisma.Sql {
    if (search === null) {
      return Prisma.empty;
    }
    const pattern = `%${escapeLikePattern(search)}%`;
    return Prisma.sql`AND (p."name" ILIKE ${pattern} OR p."sku" ILIKE ${pattern})`;
  }
}

/** daysOfCover ASC with NULLs LAST, then name ASC (contract-pinned). */
function compareRows(a: ForecastRow, b: ForecastRow): number {
  if (a.daysOfCover !== b.daysOfCover) {
    if (a.daysOfCover === null) {
      return 1;
    }
    if (b.daysOfCover === null) {
      return -1;
    }
    return a.daysOfCover - b.daysOfCover;
  }
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
