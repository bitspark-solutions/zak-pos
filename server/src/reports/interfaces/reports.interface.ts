/**
 * Wire shapes for the reports module (Phase E).
 *
 * Every envelope field is a plain JSON number — Prisma `$queryRaw` returns
 * Decimal.js objects for money/qty columns, so the service converts each row
 * with `.toNumber()` before it leaves the process (see reports.service.ts).
 * Dates are 'YYYY-MM-DD' strings with INCLUSIVE day boundaries; a
 * `shopId: null` in an envelope means "all shops of the tenant".
 */

/** The five report shapes GET endpoints serve and POST /reports/ask resolves to. */
export type ReportType =
  | 'sales-summary'
  | 'top-products'
  | 'sales-by-category'
  | 'payment-methods'
  | 'inventory-valuation';

export const REPORT_TYPES: readonly ReportType[] = [
  'sales-summary',
  'top-products',
  'sales-by-category',
  'payment-methods',
  'inventory-valuation',
];

export type GroupByPeriod = 'day' | 'week' | 'month';

export type TopProductsSortBy = 'revenue' | 'qty';

export type AskEngine = 'keyword' | 'llm';

/** Inclusive 'YYYY-MM-DD' day boundaries. */
export interface DateRange {
  from: string;
  to: string;
}

/** One of the tenant's shops, used by the NL resolver for fuzzy name matching. */
export interface TenantShopOption {
  id: string;
  name: string;
}

/** Query shape accepted by the date-ranged GET endpoints. */
export interface ReportRangeQuery {
  from?: string;
  to?: string;
  shopId?: string;
}

export interface SalesSummaryQuery extends ReportRangeQuery {
  groupBy?: GroupByPeriod;
}

export interface TopProductsQuery extends ReportRangeQuery {
  limit?: number;
  sortBy?: TopProductsSortBy;
}

export interface InventoryValuationQuery {
  shopId?: string;
}

/**
 * Fully resolved instruction for building one report — produced either by the
 * deterministic keyword parser (nl-parser.ts) or by the validated LLM plan.
 */
export interface ResolvedReportSpec {
  reportType: ReportType;
  /** Inclusive 'YYYY-MM-DD' window (unused by inventory-valuation). */
  from: string;
  to: string;
  shopId: string | null;
  groupBy: GroupByPeriod;
  /** Clamped 1..50; only meaningful for top-products. */
  limit: number;
  sortBy: TopProductsSortBy;
}

// ---------------------------------------------------------------------------
// GET /reports/sales-summary
// ---------------------------------------------------------------------------

export interface SalesSummaryRow {
  /** day 'YYYY-MM-DD' | month 'YYYY-MM' | week ISO 'YYYY-Www' */
  period: string;
  grossSales: number;
  discount: number;
  tax: number;
  netSales: number;
  txCount: number;
}

export interface SalesSummaryTotals {
  grossSales: number;
  discount: number;
  tax: number;
  netSales: number;
  txCount: number;
}

export interface SalesSummaryReport {
  reportType: 'sales-summary';
  from: string;
  to: string;
  shopId: string | null;
  groupBy: GroupByPeriod;
  rows: SalesSummaryRow[];
  totals: SalesSummaryTotals;
}

// ---------------------------------------------------------------------------
// GET /reports/top-products
// ---------------------------------------------------------------------------

export interface TopProductRow {
  productId: string;
  name: string;
  sku: string;
  qtySold: number;
  revenue: number;
}

export interface TopProductsReport {
  reportType: 'top-products';
  from: string;
  to: string;
  shopId: string | null;
  limit: number;
  sortBy: TopProductsSortBy;
  rows: TopProductRow[];
}

// ---------------------------------------------------------------------------
// GET /reports/sales-by-category
// ---------------------------------------------------------------------------

export interface SalesByCategoryRow {
  categoryId: string | null;
  /** 'Uncategorized' for products without a category. */
  categoryName: string;
  qtySold: number;
  revenue: number;
}

export interface SalesByCategoryReport {
  reportType: 'sales-by-category';
  from: string;
  to: string;
  shopId: string | null;
  rows: SalesByCategoryRow[];
}

// ---------------------------------------------------------------------------
// GET /reports/payment-methods
// ---------------------------------------------------------------------------

export interface PaymentMethodRow {
  method: string;
  count: number;
  amount: number;
}

export interface PaymentMethodsReport {
  reportType: 'payment-methods';
  from: string;
  to: string;
  shopId: string | null;
  rows: PaymentMethodRow[];
}

// ---------------------------------------------------------------------------
// GET /reports/inventory-valuation (no date range)
// ---------------------------------------------------------------------------

export interface InventoryValuationRow {
  productId: string;
  name: string;
  sku: string;
  shopId: string;
  shopName: string;
  quantityOnHand: number;
  avgCost: number;
  /** quantityOnHand * avgCost */
  valuation: number;
}

export interface InventoryValuationTotals {
  quantityOnHand: number;
  valuation: number;
}

export interface InventoryValuationReport {
  reportType: 'inventory-valuation';
  shopId: string | null;
  rows: InventoryValuationRow[];
  totals: InventoryValuationTotals;
}

/** Union of the five report envelopes — exactly one per /reports/ask answer. */
export type ReportEnvelope =
  | SalesSummaryReport
  | TopProductsReport
  | SalesByCategoryReport
  | PaymentMethodsReport
  | InventoryValuationReport;

// ---------------------------------------------------------------------------
// POST /reports/ask
// ---------------------------------------------------------------------------

export interface AskReportResponse {
  /** One human-readable sentence describing what was computed. */
  interpretation: string;
  /** Which resolver produced the spec: the LLM or the keyword parser. */
  engine: AskEngine;
  report: ReportEnvelope;
}
