/**
 * Pure forecasting math — no NestJS, no Prisma, no I/O. Every function here
 * is unit-tested in forecast-math.spec.ts; the service feeds raw SQL numbers
 * through these helpers so the algorithm is deterministic and reviewable.
 *
 * Rounding chain (pinned by the API contract): avgDailyQty is rounded to 3dp
 * FIRST, then forecastQty (1dp), currentStock (3dp), daysOfCover (1dp) and the
 * risk/order decisions are all derived from those already-rounded values.
 */
import type { ForecastRisk } from './interfaces/forecast.interface';

export const HORIZON_MIN = 3;
export const HORIZON_MAX = 90;
export const HORIZON_DEFAULT = 14;

/** Demand history spans two 28-day halves; detail history shows the last 28. */
export const HISTORY_DAYS = 28;
export const DEMAND_WINDOW_DAYS = 56;

const AVG_DAILY_DP = 3;
const FORECAST_DP = 1;
const COVER_DP = 1;
const SERIES_DP = 2;

/** Kills float-accumulation drift in JS-side math (e.g. 30.299999999999997). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor + Number.EPSILON) / factor;
}

/** Local calendar date as 'YYYY-MM-DD' (same convention as the reports module). */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shift a validated 'YYYY-MM-DD' by whole days (UTC-safe, DST-proof). */
export function addIsoDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/** horizonDays is CLAMPED into 3..90 (never a 400 on bounds); default 14. */
export function clampHorizonDays(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return HORIZON_DEFAULT;
  }
  return Math.min(HORIZON_MAX, Math.max(HORIZON_MIN, Math.trunc(raw)));
}

/** Escapes LIKE/ILIKE metacharacters so user search text matches literally. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * Weighted daily demand: 70% on the most recent 28-day half, 30% on the
 * previous one, each normalised per day. Rounded to 3dp at the source —
 * every downstream metric consumes this value as-is.
 */
export function computeAvgDailyQty(
  last28Qty: number,
  prev28Qty: number,
): number {
  return roundTo(
    0.7 * (last28Qty / HISTORY_DAYS) + 0.3 * (prev28Qty / HISTORY_DAYS),
    AVG_DAILY_DP,
  );
}

export function computeForecastQty(
  avgDailyQty: number,
  horizonDays: number,
): number {
  return roundTo(avgDailyQty * horizonDays, FORECAST_DP);
}

/** Null daysOfCover is the "no demand" signal (avgDailyQty rounds to 0). */
export function computeDaysOfCover(
  currentStock: number,
  avgDailyQty: number,
): number | null {
  return avgDailyQty > 0 ? roundTo(currentStock / avgDailyQty, COVER_DP) : null;
}

/**
 * Risk classification on the rounded values. Boundaries are half-open as
 * pinned: exactly horizonDays is NOT out_of_stock, exactly 2*horizonDays is
 * NOT low, exactly 8*horizonDays is NOT overstock.
 */
export function classifyRisk(
  daysOfCover: number | null,
  currentStock: number,
  avgDailyQty: number,
  horizonDays: number,
): ForecastRisk {
  if (daysOfCover === null) {
    return 'ok';
  }
  if (daysOfCover < horizonDays) {
    return 'out_of_stock';
  }
  if (daysOfCover < 2 * horizonDays) {
    return 'low';
  }
  if (daysOfCover > 8 * horizonDays && currentStock > 0 && avgDailyQty > 0) {
    return 'overstock';
  }
  return 'ok';
}

/** Cover up to 120% of the horizon forecast; never below zero. */
export function suggestedOrder(
  risk: ForecastRisk,
  forecastQty: number,
  currentStock: number,
): number {
  if (risk !== 'out_of_stock' && risk !== 'low') {
    return 0;
  }
  return Math.max(0, Math.ceil(roundTo(forecastQty * 1.2, 6) - currentStock));
}

/**
 * All three date windows relative to a local 'YYYY-MM-DD' today:
 * windowStart covers 56 days, lastStart splits the recent 28 from the
 * previous 28, historyStart is the first day of the zero-filled 28-day chart.
 */
export interface DemandWindows {
  today: string;
  windowStart: string;
  lastStart: string;
  historyStart: string;
}

export function computeDemandWindows(today: string): DemandWindows {
  const lastStart = addIsoDays(today, -(HISTORY_DAYS - 1));
  return {
    today,
    windowStart: addIsoDays(lastStart, -HISTORY_DAYS),
    lastStart,
    historyStart: lastStart,
  };
}

/**
 * Zero-filled daily history: exactly HISTORY_DAYS entries ending at (and
 * including) today, ASC, missing days at 0. Points outside the window or on
 * malformed dates are ignored; duplicate dates are summed.
 */
export function zeroFilledHistory(
  points: readonly { date: string; qtySold: number }[],
  today: string,
): { date: string; qtySold: number }[] {
  const byDate = new Map<string, number>();
  for (const point of points) {
    byDate.set(point.date, (byDate.get(point.date) ?? 0) + point.qtySold);
  }
  const first = addIsoDays(today, -(HISTORY_DAYS - 1));
  const history: { date: string; qtySold: number }[] = [];
  for (let offset = 0; offset < HISTORY_DAYS; offset += 1) {
    const date = addIsoDays(first, offset);
    history.push({
      date,
      qtySold: roundTo(byDate.get(date) ?? 0, AVG_DAILY_DP),
    });
  }
  return history;
}

/** Flat forward series: horizonDays entries starting tomorrow, 2dp each. */
export function buildForecastSeries(
  avgDailyQty: number,
  horizonDays: number,
  today: string,
): { date: string; expectedQty: number }[] {
  const expectedQty = roundTo(avgDailyQty, SERIES_DP);
  const series: { date: string; expectedQty: number }[] = [];
  for (let offset = 1; offset <= horizonDays; offset += 1) {
    series.push({ date: addIsoDays(today, offset), expectedQty });
  }
  return series;
}
