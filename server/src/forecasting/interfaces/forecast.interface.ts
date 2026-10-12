/**
 * Wire shapes for the forecasting module (Phase F).
 *
 * Every numeric on the wire is a plain JSON number: Prisma `$queryRaw` hands
 * money/qty columns back as Decimal.js objects and the service converts each
 * one with `.toNumber()` before it leaves the process. A `shopId: null` means
 * "all shops of the tenant".
 */

export type ForecastRisk = 'out_of_stock' | 'low' | 'ok' | 'overstock';

export const FORECAST_RISKS: readonly ForecastRisk[] = [
  'out_of_stock',
  'low',
  'ok',
  'overstock',
];

/** Query shape accepted by GET /forecast. horizonDays is clamped 3..90. */
export interface ForecastQuery {
  shopId?: string;
  horizonDays?: number;
  risk?: ForecastRisk;
  search?: string;
}

/** Query shape accepted by GET /forecast/product/:productId. */
export interface ProductForecastQuery {
  horizonDays?: number;
}

export interface ForecastRow {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  /** Weighted daily demand, 3 decimal places. */
  avgDailyQty: number;
  /** avgDailyQty * horizonDays, 1 decimal place. */
  forecastQty: number;
  /** SUM(inventory.quantityOnHand) over the matching shop(s), 3 dp. */
  currentStock: number;
  /** currentStock / avgDailyQty, 1 dp; null when avgDailyQty is 0. */
  daysOfCover: number | null;
  risk: ForecastRisk;
  /** Non-negative integer; 0 unless risk is out_of_stock or low. */
  suggestedOrderQty: number;
}

export interface ForecastTotals {
  /** Row count after search/shop filters but BEFORE the risk filter. */
  products: number;
  outOfStock: number;
  low: number;
}

export interface ForecastListResponse {
  horizonDays: number;
  shopId: string | null;
  generatedAt: string;
  rows: ForecastRow[];
  totals: ForecastTotals;
}

export interface ForecastHistoryPoint {
  /** 'YYYY-MM-DD' */
  date: string;
  /** 3 dp, zero-filled across the whole 28-day window. */
  qtySold: number;
}

export interface ForecastSeriesPoint {
  /** 'YYYY-MM-DD' */
  date: string;
  /** avgDailyQty spread flat, 2 dp. */
  expectedQty: number;
}

export interface ProductForecastResponse {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  avgDailyQty: number;
  forecastQty: number;
  currentStock: number;
  daysOfCover: number | null;
  risk: ForecastRisk;
  suggestedOrderQty: number;
  /** Last 28 days INCLUDING today, ASC, every day present. */
  history: ForecastHistoryPoint[];
  /** horizonDays entries starting tomorrow, ASC, flat at avgDailyQty. */
  forecastSeries: ForecastSeriesPoint[];
}
