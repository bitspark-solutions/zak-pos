import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import {
  addIsoDays,
  clampLimit,
  formatDateOnly,
  isValidIsoDate,
  normalizeGroupBy,
  normalizeSortBy,
} from './nl-parser';
import type {
  GroupByPeriod,
  InventoryValuationQuery,
  InventoryValuationReport,
  PaymentMethodsReport,
  ReportRangeQuery,
  ResolvedReportSpec,
  SalesByCategoryReport,
  SalesSummaryQuery,
  SalesSummaryReport,
  TenantShopOption,
  TopProductsQuery,
  TopProductsReport,
  ReportEnvelope,
  DateRange,
} from './interfaces/reports.interface';

/**
 * Raw-SQL row shapes. `$queryRaw` hands money/qty columns back as Decimal.js
 * objects (Prisma.Decimal) and int-cast counts as numbers; every one is
 * converted to a plain number before it reaches the response envelope.
 */
interface SalesSummaryRawRow {
  period: string;
  grossSales: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  netSales: Prisma.Decimal;
  txCount: number;
}

interface TopProductsRawRow {
  productId: string;
  name: string;
  sku: string;
  qtySold: Prisma.Decimal;
  revenue: Prisma.Decimal;
}

interface SalesByCategoryRawRow {
  categoryId: string | null;
  categoryName: string;
  qtySold: Prisma.Decimal;
  revenue: Prisma.Decimal;
}

interface PaymentMethodsRawRow {
  method: string;
  count: number;
  amount: Prisma.Decimal;
}

interface InventoryValuationRawRow {
  productId: string;
  name: string;
  sku: string;
  shopId: string;
  shopName: string;
  quantityOnHand: Prisma.Decimal;
  avgCost: Prisma.Decimal;
  valuation: Prisma.Decimal;
}

/** Money columns are Decimal(15,2); qty columns Decimal(15,3). */
const MONEY_DECIMALS = 2;
const QTY_DECIMALS = 3;

function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

/** Kills float-accumulation drift in JS-side sums (e.g. 30.299999999999997). */
function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor + Number.EPSILON) / factor;
}

/**
 * The five report resolvers. ALL reads run through
 * `databaseService.withTenant` (DB-enforced RLS via `app.tenant_id`); the
 * admin `getPrisma()` client is never used here. Aggregations use raw SQL
 * with Prisma.sql tagged templates only — every user value is a bound
 * parameter, never string-concatenated.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly databaseService: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // 1. GET /reports/sales-summary
  // ---------------------------------------------------------------------------

  async getSalesSummary(
    query: SalesSummaryQuery,
    tenantId: string,
  ): Promise<SalesSummaryReport> {
    const groupBy = normalizeGroupBy(query.groupBy);
    const range = this.resolveRange(query);
    const shopId = this.normalizeShopId(query.shopId);
    const rows = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<SalesSummaryRawRow[]>`
          SELECT ${this.periodExpression(groupBy)} AS period,
            COALESCE(SUM(s."subtotal"), 0) AS "grossSales",
            COALESCE(SUM(s."discount"), 0) AS discount,
            COALESCE(SUM(s."tax"), 0) AS tax,
            COALESCE(SUM(s."total"), 0) AS "netSales",
            COUNT(*)::int AS "txCount"
          FROM sales s
          WHERE s."tenantId" = ${tenantId}
            AND s."status" = 'completed'
            AND s."createdAt" >= ${range.from}::date
            AND s."createdAt" < (${range.to}::date + INTERVAL '1 day')
            ${this.shopClause(shopId, 's')}
          GROUP BY 1
          ORDER BY 1 ASC`,
    );

    const mapped = rows.map((row) => ({
      period: row.period,
      grossSales: round(toNumber(row.grossSales), MONEY_DECIMALS),
      discount: round(toNumber(row.discount), MONEY_DECIMALS),
      tax: round(toNumber(row.tax), MONEY_DECIMALS),
      netSales: round(toNumber(row.netSales), MONEY_DECIMALS),
      txCount: toNumber(row.txCount),
    }));

    return {
      reportType: 'sales-summary',
      from: range.from,
      to: range.to,
      shopId,
      groupBy,
      rows: mapped,
      totals: {
        grossSales: round(
          sumBy(mapped, (row) => row.grossSales),
          MONEY_DECIMALS,
        ),
        discount: round(
          sumBy(mapped, (row) => row.discount),
          MONEY_DECIMALS,
        ),
        tax: round(
          sumBy(mapped, (row) => row.tax),
          MONEY_DECIMALS,
        ),
        netSales: round(
          sumBy(mapped, (row) => row.netSales),
          MONEY_DECIMALS,
        ),
        txCount: sumBy(mapped, (row) => row.txCount),
      },
    };
  }

  /**
   * Period bucket expressions are pinned by the API contract:
   * day 'YYYY-MM-DD', month 'YYYY-MM', week ISO 'IYYY-Www'.
   * Chosen from a validated enum — never from user text.
   */
  private periodExpression(groupBy: GroupByPeriod): Prisma.Sql {
    switch (groupBy) {
      case 'week':
        return Prisma.sql`to_char(date_trunc('week', s."createdAt"), 'IYYY-"W"IW')`;
      case 'month':
        return Prisma.sql`to_char(s."createdAt", 'YYYY-MM')`;
      case 'day':
        return Prisma.sql`to_char(s."createdAt", 'YYYY-MM-DD')`;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. GET /reports/top-products
  // ---------------------------------------------------------------------------

  async getTopProducts(
    query: TopProductsQuery,
    tenantId: string,
  ): Promise<TopProductsReport> {
    const range = this.resolveRange(query);
    const shopId = this.normalizeShopId(query.shopId);
    const limit = clampLimit(query.limit);
    const sortBy = normalizeSortBy(query.sortBy);

    const sortExpression =
      sortBy === 'qty'
        ? Prisma.sql`COALESCE(SUM(sl."qty"), 0)`
        : Prisma.sql`COALESCE(SUM(sl."lineTotal"), 0)`;

    const rows = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<TopProductsRawRow[]>`
          SELECT sl."productId" AS "productId",
            p."name" AS "name",
            p."sku" AS "sku",
            COALESCE(SUM(sl."qty"), 0) AS "qtySold",
            COALESCE(SUM(sl."lineTotal"), 0) AS revenue
          FROM sale_lines sl
          JOIN sales s ON s."id" = sl."saleId"
          JOIN products p ON p."id" = sl."productId"
          WHERE sl."tenantId" = ${tenantId}
            AND s."status" = 'completed'
            AND s."createdAt" >= ${range.from}::date
            AND s."createdAt" < (${range.to}::date + INTERVAL '1 day')
            ${this.shopClause(shopId, 's')}
          GROUP BY sl."productId", p."name", p."sku"
          ORDER BY ${sortExpression} DESC,
            COALESCE(SUM(sl."lineTotal"), 0) DESC
          LIMIT ${limit}`,
    );

    return {
      reportType: 'top-products',
      from: range.from,
      to: range.to,
      shopId,
      limit,
      sortBy,
      rows: rows.map((row) => ({
        productId: row.productId,
        name: row.name,
        sku: row.sku,
        qtySold: round(toNumber(row.qtySold), QTY_DECIMALS),
        revenue: round(toNumber(row.revenue), MONEY_DECIMALS),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. GET /reports/sales-by-category
  // ---------------------------------------------------------------------------

  async getSalesByCategory(
    query: ReportRangeQuery,
    tenantId: string,
  ): Promise<SalesByCategoryReport> {
    const range = this.resolveRange(query);
    const shopId = this.normalizeShopId(query.shopId);
    const rows = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<SalesByCategoryRawRow[]>`
          SELECT c."id" AS "categoryId",
            COALESCE(c."name", 'Uncategorized') AS "categoryName",
            COALESCE(SUM(sl."qty"), 0) AS "qtySold",
            COALESCE(SUM(sl."lineTotal"), 0) AS revenue
          FROM sale_lines sl
          JOIN sales s ON s."id" = sl."saleId"
          JOIN products p ON p."id" = sl."productId"
          LEFT JOIN categories c ON c."id" = p."categoryId"
          WHERE sl."tenantId" = ${tenantId}
            AND s."status" = 'completed'
            AND s."createdAt" >= ${range.from}::date
            AND s."createdAt" < (${range.to}::date + INTERVAL '1 day')
            ${this.shopClause(shopId, 's')}
          GROUP BY c."id", c."name"
          ORDER BY COALESCE(SUM(sl."lineTotal"), 0) DESC`,
    );

    return {
      reportType: 'sales-by-category',
      from: range.from,
      to: range.to,
      shopId,
      rows: rows.map((row) => ({
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        qtySold: round(toNumber(row.qtySold), QTY_DECIMALS),
        revenue: round(toNumber(row.revenue), MONEY_DECIMALS),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 4. GET /reports/payment-methods
  // ---------------------------------------------------------------------------

  async getPaymentMethods(
    query: ReportRangeQuery,
    tenantId: string,
  ): Promise<PaymentMethodsReport> {
    const range = this.resolveRange(query);
    const shopId = this.normalizeShopId(query.shopId);
    const rows = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<PaymentMethodsRawRow[]>`
          SELECT pm."method" AS method,
            COUNT(*)::int AS count,
            COALESCE(SUM(pm."amount"), 0) AS amount
          FROM payments pm
          JOIN sales s ON s."id" = pm."saleId"
          WHERE pm."tenantId" = ${tenantId}
            AND pm."direction" = 'in'
            AND s."status" = 'completed'
            AND s."createdAt" >= ${range.from}::date
            AND s."createdAt" < (${range.to}::date + INTERVAL '1 day')
            ${this.shopClause(shopId, 's')}
          GROUP BY pm."method"
          ORDER BY COALESCE(SUM(pm."amount"), 0) DESC`,
    );

    return {
      reportType: 'payment-methods',
      from: range.from,
      to: range.to,
      shopId,
      rows: rows.map((row) => ({
        method: row.method,
        count: toNumber(row.count),
        amount: round(toNumber(row.amount), MONEY_DECIMALS),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 5. GET /reports/inventory-valuation
  // ---------------------------------------------------------------------------

  /**
   * No date range. NOTE: `inventory` has NO tenantId column — the RLS policy
   * `inventory_tenant_isolation` scopes rows through `shops."tenantId"`
   * (see migration 20261012100000_add_tenant_rls), and the module precedent
   * (inventory.service.ts getStock) additionally filters `product.tenantId`;
   * we do the same explicitly here on top of withTenant's app.tenant_id GUC.
   * All inventory rows (base and variant) are valued.
   */
  async getInventoryValuation(
    query: InventoryValuationQuery,
    tenantId: string,
  ): Promise<InventoryValuationReport> {
    const shopId = this.normalizeShopId(query.shopId);
    const rows = await this.databaseService.withTenant(
      tenantId,
      (tx) =>
        tx.$queryRaw<InventoryValuationRawRow[]>`
          SELECT i."productId" AS "productId",
            p."name" AS "name",
            p."sku" AS "sku",
            i."shopId" AS "shopId",
            sh."name" AS "shopName",
            i."quantityOnHand" AS "quantityOnHand",
            i."avgCost" AS "avgCost",
            (i."quantityOnHand" * i."avgCost") AS valuation
          FROM inventory i
          JOIN products p ON p."id" = i."productId"
          JOIN shops sh ON sh."id" = i."shopId"
          WHERE p."tenantId" = ${tenantId}
            ${this.shopClause(shopId, 'i')}
          ORDER BY (i."quantityOnHand" * i."avgCost") DESC`,
    );

    const mapped = rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      shopId: row.shopId,
      shopName: row.shopName,
      quantityOnHand: round(toNumber(row.quantityOnHand), QTY_DECIMALS),
      avgCost: round(toNumber(row.avgCost), MONEY_DECIMALS),
      valuation: round(toNumber(row.valuation), MONEY_DECIMALS),
    }));

    return {
      reportType: 'inventory-valuation',
      shopId,
      rows: mapped,
      totals: {
        quantityOnHand: round(
          sumBy(mapped, (row) => row.quantityOnHand),
          QTY_DECIMALS,
        ),
        valuation: round(
          sumBy(mapped, (row) => row.valuation),
          MONEY_DECIMALS,
        ),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  /** Shop directory of the tenant — feeds the NL parser's fuzzy matching. */
  async listTenantShops(tenantId: string): Promise<TenantShopOption[]> {
    return this.databaseService.withTenant(tenantId, (tx) =>
      tx.shop.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  /** Build the report envelope for a resolved spec (used by POST /reports/ask). */
  buildReport(
    spec: ResolvedReportSpec,
    tenantId: string,
  ): Promise<ReportEnvelope> {
    const rangeQuery: ReportRangeQuery = {
      from: spec.from,
      to: spec.to,
      shopId: spec.shopId ?? undefined,
    };
    switch (spec.reportType) {
      case 'sales-summary':
        return this.getSalesSummary(
          { ...rangeQuery, groupBy: spec.groupBy },
          tenantId,
        );
      case 'top-products':
        return this.getTopProducts(
          { ...rangeQuery, limit: spec.limit, sortBy: spec.sortBy },
          tenantId,
        );
      case 'sales-by-category':
        return this.getSalesByCategory(rangeQuery, tenantId);
      case 'payment-methods':
        return this.getPaymentMethods(rangeQuery, tenantId);
      case 'inventory-valuation':
        return this.getInventoryValuation(
          { shopId: spec.shopId ?? undefined },
          tenantId,
        );
    }
  }

  /**
   * Inclusive 'YYYY-MM-DD' day window. Defaults (server-local date):
   * from = today-29, to = today. Malformed or inverted ranges are 400.
   */
  private resolveRange(query: ReportRangeQuery): DateRange {
    const today = formatDateOnly(new Date());
    const from =
      query.from !== undefined && query.from !== ''
        ? query.from
        : addIsoDays(today, -29);
    const to = query.to !== undefined && query.to !== '' ? query.to : today;

    if (!isValidIsoDate(from)) {
      throw new BadRequestException(
        `Invalid "from" date: ${String(from)} (expected YYYY-MM-DD)`,
      );
    }
    if (!isValidIsoDate(to)) {
      throw new BadRequestException(
        `Invalid "to" date: ${String(to)} (expected YYYY-MM-DD)`,
      );
    }
    if (from > to) {
      throw new BadRequestException(
        '"from" date must be on or before "to" date',
      );
    }
    return { from, to };
  }

  private normalizeShopId(shopId: string | undefined): string | null {
    const trimmed = (shopId ?? '').trim();
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
}

function sumBy<T>(rows: readonly T[], pick: (row: T) => number): number {
  return rows.reduce((acc, row) => acc + pick(row), 0);
}
