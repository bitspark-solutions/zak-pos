// Types for the Phase E reports API (GET /reports/*, POST /reports/ask).
// Mirrors the pinned server contract exactly; kept next to the receipts
// types precedent (src/types/receipts.ts) so the UI can be built ahead of
// the backend. All numeric fields are JSON numbers.

export type SalesGroupBy = 'day' | 'week' | 'month';
export type TopProductsSortBy = 'revenue' | 'qty';
export type AskEngine = 'keyword' | 'llm';

/** GET /reports/sales-summary */
export interface SalesSummaryRow {
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
  groupBy: SalesGroupBy;
  rows: SalesSummaryRow[];
  totals: SalesSummaryTotals;
}

/** GET /reports/top-products */
export interface TopProductsRow {
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
  rows: TopProductsRow[];
}

/** GET /reports/sales-by-category */
export interface SalesByCategoryRow {
  categoryId: string | null;
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

/** GET /reports/payment-methods */
export interface PaymentMethodsRow {
  method: string;
  count: number;
  amount: number;
}

export interface PaymentMethodsReport {
  reportType: 'payment-methods';
  from: string;
  to: string;
  shopId: string | null;
  rows: PaymentMethodsRow[];
}

/** GET /reports/inventory-valuation — no date range; stock is "as of now". */
export interface InventoryValuationRow {
  productId: string;
  name: string;
  sku: string;
  shopId: string;
  shopName: string;
  quantityOnHand: number;
  avgCost: number;
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

/** Discriminated union over reportType — also used to unwrap POST /reports/ask. */
export type AnyReport =
  | SalesSummaryReport
  | TopProductsReport
  | SalesByCategoryReport
  | PaymentMethodsReport
  | InventoryValuationReport;

export type ReportType = AnyReport['reportType'];

/** POST /reports/ask response. */
export interface AskReportResult {
  interpretation: string;
  engine: AskEngine;
  report: AnyReport;
}

// --- Query shapes accepted by the api client (src/lib/api/reports.ts) ---

export interface DateRangeQuery {
  /** 'YYYY-MM-DD' */
  from: string;
  /** 'YYYY-MM-DD' */
  to: string;
  /** Omitted for "All shops". */
  shopId?: string;
}

export type SalesSummaryQuery = DateRangeQuery & { groupBy: SalesGroupBy };
export type TopProductsQuery = DateRangeQuery & {
  limit: number;
  sortBy: TopProductsSortBy;
};
export type SalesByCategoryQuery = DateRangeQuery;
export type PaymentMethodsQuery = DateRangeQuery;
export interface InventoryValuationQuery {
  shopId?: string;
}

export interface AskQuery {
  /** Max 500 chars (enforced server-side). */
  question: string;
  shopId?: string;
}

// --- Formatting ---

const bdtDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const bdtInteger = new Intl.NumberFormat('en-US');

/**
 * Money as `BDT 1,234.56` — thousands separators, always 2 decimals.
 * Non-finite inputs collapse to zero so a bad row never prints `NaN`.
 */
export function formatBdt(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `BDT ${bdtDecimal.format(safe)}`;
}

/** Plain integer with thousands separators (counts, quantities). */
export function formatCount(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return bdtInteger.format(safe);
}
