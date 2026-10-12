// Types for the Phase F stock forecasting API (GET /forecast,
// GET /forecast/product/:productId). Mirrors the pinned server contract
// exactly; all numeric fields are JSON numbers.
//
// Count/money formatting is reused from src/types/reports.ts (formatCount);
// this module only adds the quantity formatters the forecast tables need.

export type ForecastRisk = 'out_of_stock' | 'low' | 'ok' | 'overstock';

export const RISK_LABELS: Record<ForecastRisk, string> = {
  out_of_stock: 'Out of stock',
  low: 'Low',
  ok: 'OK',
  overstock: 'Overstock',
};

/** GET /forecast row — pre-sorted server-side (daysOfCover asc, nulls last). */
export interface ForecastRow {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  avgDailyQty: number;
  forecastQty: number;
  currentStock: number;
  /** null when the product sells nothing (infinite days of cover). */
  daysOfCover: number | null;
  risk: ForecastRisk;
  suggestedOrderQty: number;
}

export interface ForecastTotals {
  products: number;
  outOfStock: number;
  low: number;
}

export interface ForecastListResponse {
  horizonDays: number;
  shopId: string | null;
  /** ISO timestamp of when the snapshot was generated. */
  generatedAt: string;
  rows: ForecastRow[];
  totals: ForecastTotals;
}

/** GET /forecast/product/:productId */
export interface ForecastHistoryPoint {
  /** 'YYYY-MM-DD' — 28 zero-filled days, ascending. */
  date: string;
  qtySold: number;
}

export interface ForecastSeriesPoint {
  /** 'YYYY-MM-DD' — starts tomorrow, flat expected qty. */
  date: string;
  expectedQty: number;
}

export interface ForecastProductDetail {
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
  history: ForecastHistoryPoint[];
  forecastSeries: ForecastSeriesPoint[];
}

// --- Query shapes accepted by the api client (src/lib/api/forecast.ts) ---

export interface ForecastListQuery {
  /** 7 | 14 | 30 | 60 (UI select); the server clamps anything else. */
  horizonDays: number;
  /** Omitted for "All shops". */
  shopId?: string;
  /** Omitted for the "All" risk chip. */
  risk?: ForecastRisk;
  /** Omitted when blank; debounced 300ms in the UI. */
  search?: string;
}

export interface ForecastDetailQuery {
  horizonDays?: number;
}

// --- Formatting ---

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** Quantity at 1 decimal, e.g. `12.4`. Non-finite inputs collapse to zero. */
export function formatQty1(value: number): string {
  return safeNumber(value).toFixed(1);
}

/** Quantity at 3 decimals (avg daily burn), e.g. `1.607`. */
export function formatQty3(value: number): string {
  return safeNumber(value).toFixed(3);
}

/**
 * Days of cover: null renders as an em dash (the "infinite cover" case —
 * the product sells nothing), otherwise 1 decimal + `d`, e.g. `3.5d`.
 */
export function formatDaysOfCover(value: number | null): string {
  return value === null ? '—' : `${formatQty1(value)}d`;
}
