/**
 * Deterministic natural-language parser for POST /reports/ask.
 *
 * Pure functions only — no I/O, no Nest DI, clock injected as a parameter —
 * so they are trivially unit-testable and always available as a transparent
 * fallback when the optional LLM plan extraction fails.
 */

import type {
  DateRange,
  GroupByPeriod,
  ReportType,
  ResolvedReportSpec,
  TenantShopOption,
  TopProductsSortBy,
} from './interfaces/reports.interface';
import { REPORT_TYPES } from './interfaces/reports.interface';

/** reportType keywords, checked in this exact priority order (contract-pinned). */
const REPORT_TYPE_KEYWORDS: ReadonlyArray<
  readonly [ReportType, readonly string[]]
> = [
  ['inventory-valuation', ['inventory', 'stock', 'valuation']],
  ['sales-by-category', ['category', 'categories']],
  [
    'payment-methods',
    ['payment', 'cash', 'card', 'bkash', 'nagad', 'mobile money'],
  ],
  ['top-products', ['top', 'best']],
  ['sales-summary', ['sale', 'sales', 'revenue', 'daily', 'summary', 'income']],
];

const DEFAULT_TOP_LIMIT = 10;
const MIN_TOP_LIMIT = 1;
const MAX_TOP_LIMIT = 50;

/** Default window: last 30 days = today-29 .. today (inclusive). */
const DEFAULT_WINDOW_DAYS = 29;

const ISO_DATE_SOURCE = String.raw`\d{4}-\d{2}-\d{2}`;
const EXPLICIT_RANGE_RE = new RegExp(
  `(${ISO_DATE_SOURCE})\\s+(?:to|through|until|-)\\s+(${ISO_DATE_SOURCE})`,
  'i',
);
const LAST_N_DAYS_RE = /last\s+(\d{1,3}|[a-z]+(?:[ -][a-z]+)?)\s+days?/i;

const ONES_WORDS: readonly string[] = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS_WORDS: Readonly<Record<string, number>> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40, // tolerated misspelling
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

// ---------------------------------------------------------------------------
// Date helpers (all 'YYYY-MM-DD', UTC-anchored arithmetic)
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict 'YYYY-MM-DD' check: shape AND round-trip (rejects 2026-02-30 etc). */
export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Local calendar date as 'YYYY-MM-DD' — the timezone-agnostic server date. */
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Shift a validated 'YYYY-MM-DD' by whole days. */
export function addIsoDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function lastDayOfMonth(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(1);
  parsed.setUTCMonth(parsed.getUTCMonth() + 1);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

/** ISO weekday (Mon=1 .. Sun=7) of a calendar date. */
function isoWeekday(value: string): number {
  const day = new Date(`${value}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function startOfIsoWeek(value: string): string {
  return addIsoDays(value, 1 - isoWeekday(value));
}

/** today-29 .. today (the contract's "default last 30 days"). */
export function defaultRange(now: Date): DateRange {
  const to = formatDateOnly(now);
  return { from: addIsoDays(to, -DEFAULT_WINDOW_DAYS), to };
}

/** 'two' | 'twenty five' | 'twenty-five' | '31' -> number, else null. */
export function wordsToNumber(raw: string): number | null {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ');
  if (/^\d+$/.test(text)) {
    return Number(text);
  }
  const tokens = text.split(/\s+/);
  if (tokens.length === 1) {
    const onesIndex = ONES_WORDS.indexOf(tokens[0]);
    if (onesIndex > 0) {
      return onesIndex;
    }
    return TENS_WORDS[tokens[0]] ?? null;
  }
  if (tokens.length === 2) {
    const tens = TENS_WORDS[tokens[0]];
    const onesIndex = ONES_WORDS.indexOf(tokens[1]);
    if (tens !== undefined && onesIndex > 0 && onesIndex < 10) {
      return tens + onesIndex;
    }
  }
  return null;
}

/**
 * Resolve the 'from'/'to' window from date phrases in the (free-form) question.
 * Priority: explicit range > yesterday > today > last/this week >
 * last/this month > last N days > default last 30 days.
 * `now` is injected for deterministic tests.
 */
export function resolveDateRange(text: string, now: Date): DateRange {
  const today = formatDateOnly(now);

  const range = EXPLICIT_RANGE_RE.exec(text);
  if (
    range &&
    isValidIsoDate(range[1]) &&
    isValidIsoDate(range[2]) &&
    range[1] <= range[2]
  ) {
    return { from: range[1], to: range[2] };
  }

  const lower = text.toLowerCase();
  if (/\byesterday\b/.test(lower)) {
    const yesterday = addIsoDays(today, -1);
    return { from: yesterday, to: yesterday };
  }
  if (/\btoday\b/.test(lower)) {
    return { from: today, to: today };
  }
  if (/\blast week\b/.test(lower)) {
    const thisMonday = startOfIsoWeek(today);
    const from = addIsoDays(thisMonday, -7);
    return { from, to: addIsoDays(from, 6) };
  }
  if (/\bthis week\b/.test(lower)) {
    return { from: startOfIsoWeek(today), to: today };
  }
  if (/\blast month\b/.test(lower)) {
    const firstThisMonth = `${today.slice(0, 7)}-01`;
    const from = addIsoDays(firstThisMonth, -1);
    return { from: `${from.slice(0, 7)}-01`, to: lastDayOfMonth(from) };
  }
  if (/\bthis month\b/.test(lower)) {
    return { from: `${today.slice(0, 7)}-01`, to: today };
  }

  const lastN = LAST_N_DAYS_RE.exec(lower);
  if (lastN) {
    const days = wordsToNumber(lastN[1]);
    if (days !== null && days >= 1 && days <= 365) {
      return { from: addIsoDays(today, -(days - 1)), to: today };
    }
  }

  return defaultRange(now);
}

// ---------------------------------------------------------------------------
// Keyword detection
// ---------------------------------------------------------------------------

/** Highest-priority reportType keyword present in the text; null when none. */
export function detectReportType(text: string): ReportType | null {
  const lower = text.toLowerCase();
  for (const [reportType, keywords] of REPORT_TYPE_KEYWORDS) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return reportType;
    }
  }
  return null;
}

/** Fuzzy contains-match (case-insensitive); the longest shop name wins ties. */
export function matchShopByName(
  text: string,
  shops: readonly TenantShopOption[],
): TenantShopOption | null {
  const lower = text.toLowerCase();
  let best: TenantShopOption | null = null;
  for (const shop of shops) {
    const name = shop.name.toLowerCase().trim();
    if (name === '' || !lower.includes(name)) {
      continue;
    }
    if (!best || name.length > best.name.length) {
      best = shop;
    }
  }
  return best;
}

/**
 * Leading numeric tokens of a phrase: 'twenty products' -> 20,
 * 'twenty one' -> 21, 'banana split' -> null. Guards against the greedy
 * word capture of parseLimit swallowing the following noun.
 */
function numberFromLeadingTokens(raw: string): number | null {
  const tokens = raw
    .trim()
    .toLowerCase()
    .split(/[\s-]+/);
  if (tokens.length >= 2) {
    const compound = wordsToNumber(`${tokens[0]} ${tokens[1]}`);
    if (compound !== null) {
      return compound;
    }
  }
  return wordsToNumber(tokens[0]);
}

/** 'top 5 products' / 'top twenty products' -> 5 / 20, clamped 1..50; null when absent. */
export function parseLimit(text: string): number | null {
  const match = /(?:top|best)\s+(\d{1,3}|[a-z]+(?:[ -][a-z]+)?)\b/i.exec(text);
  if (!match) {
    return null;
  }
  const value = numberFromLeadingTokens(match[1]);
  if (value === null || value < MIN_TOP_LIMIT) {
    return null;
  }
  return Math.min(MAX_TOP_LIMIT, value);
}

/** 'by quantity' / 'units' / 'volume' -> 'qty', otherwise 'revenue' (contract default). */
export function parseSortBy(text: string): TopProductsSortBy {
  const lower = text.toLowerCase();
  return /\bquantit(y|ies)\b|\bunits?\b|\bvolume\b/.test(lower)
    ? 'qty'
    : 'revenue';
}

export function clampLimit(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return DEFAULT_TOP_LIMIT;
  }
  return Math.min(MAX_TOP_LIMIT, Math.max(MIN_TOP_LIMIT, Math.trunc(value)));
}

export function normalizeGroupBy(value: unknown): GroupByPeriod {
  return value === 'week' || value === 'month' ? value : 'day';
}

export function normalizeSortBy(value: unknown): TopProductsSortBy {
  return value === 'qty' ? 'qty' : 'revenue';
}

export function isReportType(value: unknown): value is ReportType {
  return (
    typeof value === 'string' &&
    (REPORT_TYPES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Full question parse (keyword engine)
// ---------------------------------------------------------------------------

export interface KeywordParseOptions {
  shops: readonly TenantShopOption[];
  now: Date;
  /** Explicit body shopId overrides everything (contract-pinned). */
  explicitShopId?: string;
}

export interface KeywordParseResult {
  reportType: ReportType | null;
  range: DateRange;
  shopId: string | null;
  limit: number;
  sortBy: TopProductsSortBy;
}

/**
 * Deterministic parse of a natural-language question into a report request.
 * `reportType === null` means "no report matched" — the caller must 400 with
 * the supported-topics hint.
 */
export function parseQuestion(
  question: string,
  options: KeywordParseOptions,
): KeywordParseResult {
  return {
    reportType: detectReportType(question),
    range: resolveDateRange(question, options.now),
    shopId: resolveShopId(question, options),
    limit: clampLimit(parseLimit(question)),
    sortBy: parseSortBy(question),
  };
}

function resolveShopId(
  question: string,
  options: KeywordParseOptions,
): string | null {
  const explicit = (options.explicitShopId ?? '').trim();
  if (explicit !== '') {
    return explicit;
  }
  return matchShopByName(question, options.shops)?.id ?? null;
}

/** Assemble a fully-resolved spec from a keyword parse result. */
export function toResolvedSpec(
  result: KeywordParseResult,
): ResolvedReportSpec | null {
  if (result.reportType === null) {
    return null;
  }
  return {
    reportType: result.reportType,
    from: result.range.from,
    to: result.range.to,
    shopId: result.shopId,
    groupBy: 'day',
    limit: result.limit,
    sortBy: result.sortBy,
  };
}

// ---------------------------------------------------------------------------
// Interpretation sentence
// ---------------------------------------------------------------------------

/** One human-readable sentence describing the resolved report. */
export function interpretSpec(
  spec: ResolvedReportSpec,
  shopName: string | null,
): string {
  const shopSuffix = shopName !== null ? ` at ${shopName}` : '';
  switch (spec.reportType) {
    case 'inventory-valuation':
      return `Inventory valuation${shopSuffix || ' across all shops'}`;
    case 'top-products':
      // Matches the contract example: "Top products by revenue from ... to ...".
      return `Top products by ${spec.sortBy} from ${spec.from} to ${spec.to}${shopSuffix}`;
    case 'sales-by-category':
      return `Sales by category from ${spec.from} to ${spec.to}${shopSuffix}`;
    case 'payment-methods':
      return `Payment methods from ${spec.from} to ${spec.to}${shopSuffix}`;
    case 'sales-summary':
      return `Sales summary from ${spec.from} to ${spec.to}${shopSuffix}`;
  }
}
