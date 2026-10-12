import {
  addIsoDays,
  clampLimit,
  defaultRange,
  detectReportType,
  formatDateOnly,
  interpretSpec,
  isValidIsoDate,
  matchShopByName,
  parseLimit,
  parseQuestion,
  parseSortBy,
  resolveDateRange,
  toResolvedSpec,
  wordsToNumber,
} from './nl-parser';
import type { ResolvedReportSpec } from './interfaces/reports.interface';
import type { TenantShopOption } from './interfaces/reports.interface';

/**
 * All tests anchor on this server date: Monday 2026-10-12 (local).
 * Local Date construction + formatDateOnly keep expectations timezone-safe.
 */
const MON_12_OCT = new Date(2026, 9, 12, 9, 0, 0);
const WED_14_OCT = new Date(2026, 9, 14, 9, 0, 0);

const SHOPS: TenantShopOption[] = [
  { id: 'shop-1', name: 'Main Store' },
  { id: 'shop-2', name: 'Downtown' },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

describe('date helpers', () => {
  it('isValidIsoDate rejects malformed and impossible dates', () => {
    expect(isValidIsoDate('2026-10-12')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('12-10-2026')).toBe(false);
    expect(isValidIsoDate('')).toBe(false);
    expect(isValidIsoDate(42)).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
  });

  it('addIsoDays shifts whole days', () => {
    expect(addIsoDays('2026-10-12', -29)).toBe('2026-09-13');
    expect(addIsoDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addIsoDays('2026-02-27', 2)).toBe('2026-03-01');
  });

  it('formatDateOnly renders the local calendar date', () => {
    expect(formatDateOnly(MON_12_OCT)).toBe('2026-10-12');
    expect(formatDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('defaultRange is today-29..today (last 30 days inclusive)', () => {
    expect(defaultRange(MON_12_OCT)).toEqual({
      from: '2026-09-13',
      to: '2026-10-12',
    });
  });
});

// ---------------------------------------------------------------------------
// resolveDateRange
// ---------------------------------------------------------------------------

describe('resolveDateRange', () => {
  it('falls back to the last-30-days default when no date phrase matches', () => {
    expect(resolveDateRange('how are sales doing', MON_12_OCT)).toEqual({
      from: '2026-09-13',
      to: '2026-10-12',
    });
  });

  it('parses yesterday and today', () => {
    expect(resolveDateRange('sales yesterday', MON_12_OCT)).toEqual({
      from: '2026-10-11',
      to: '2026-10-11',
    });
    expect(resolveDateRange('sales today', MON_12_OCT)).toEqual({
      from: '2026-10-12',
      to: '2026-10-12',
    });
  });

  it('parses this week and last week on ISO Monday boundaries', () => {
    // Wednesday 2026-10-14: week started Monday 2026-10-12.
    expect(resolveDateRange('revenue this week', WED_14_OCT)).toEqual({
      from: '2026-10-12',
      to: '2026-10-14',
    });
    // Monday 2026-10-12: last week = 2026-10-05 .. 2026-10-11.
    expect(resolveDateRange('revenue last week', MON_12_OCT)).toEqual({
      from: '2026-10-05',
      to: '2026-10-11',
    });
  });

  it('parses this month and last month', () => {
    expect(resolveDateRange('sales this month', MON_12_OCT)).toEqual({
      from: '2026-10-01',
      to: '2026-10-12',
    });
    expect(resolveDateRange('sales last month', MON_12_OCT)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('parses last N days as digits and as words', () => {
    expect(resolveDateRange('top products last 7 days', MON_12_OCT)).toEqual({
      from: '2026-10-06',
      to: '2026-10-12',
    });
    expect(resolveDateRange('sales last seven days', MON_12_OCT)).toEqual({
      from: '2026-10-06',
      to: '2026-10-12',
    });
    expect(resolveDateRange('sales last twenty-one days', MON_12_OCT)).toEqual({
      from: '2026-09-22',
      to: '2026-10-12',
    });
    // 'last 30 days' equals the default window (today-29..today inclusive).
    expect(resolveDateRange('sales last 30 days', MON_12_OCT)).toEqual({
      from: '2026-09-13',
      to: '2026-10-12',
    });
  });

  it('parses an explicit YYYY-MM-DD to YYYY-MM-DD range', () => {
    expect(
      resolveDateRange('sales summary 2026-01-01 to 2026-01-31', MON_12_OCT),
    ).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('ignores an inverted explicit range and keeps the default', () => {
    expect(
      resolveDateRange('sales 2026-05-01 to 2026-04-01', MON_12_OCT),
    ).toEqual({ from: '2026-09-13', to: '2026-10-12' });
  });
});

// ---------------------------------------------------------------------------
// wordsToNumber / limits / sorting
// ---------------------------------------------------------------------------

describe('wordsToNumber', () => {
  it('converts digits, ones and compound tens', () => {
    expect(wordsToNumber('7')).toBe(7);
    expect(wordsToNumber('seven')).toBe(7);
    expect(wordsToNumber('nineteen')).toBe(19);
    expect(wordsToNumber('twenty')).toBe(20);
    expect(wordsToNumber('twenty five')).toBe(25);
    expect(wordsToNumber('Ninety')).toBe(90);
    expect(wordsToNumber('banana')).toBeNull();
  });
});

describe('parseLimit / clampLimit', () => {
  it('reads the number after top/best and clamps to 1..50', () => {
    expect(parseLimit('top 5 products')).toBe(5);
    expect(parseLimit('best 3 sellers')).toBe(3);
    expect(parseLimit('top twenty products')).toBe(20);
    expect(parseLimit('top 100 products')).toBe(50); // clamped
    expect(parseLimit('top products')).toBeNull();
    expect(clampLimit(undefined)).toBe(10);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(999)).toBe(50);
    expect(clampLimit(7.8)).toBe(7);
  });
});

describe('parseSortBy', () => {
  it('maps quantity words to qty, everything else to revenue', () => {
    expect(parseSortBy('top 5 products by quantity')).toBe('qty');
    expect(parseSortBy('best sellers by units')).toBe('qty');
    expect(parseSortBy('top products by revenue')).toBe('revenue');
    expect(parseSortBy('top products')).toBe('revenue');
  });
});

// ---------------------------------------------------------------------------
// reportType keywords / shop matching
// ---------------------------------------------------------------------------

describe('detectReportType', () => {
  it('maps each keyword family to its report (contract priority order)', () => {
    expect(detectReportType('whats our stock level')).toBe(
      'inventory-valuation',
    );
    expect(detectReportType('show me the inventory valuation')).toBe(
      'inventory-valuation',
    );
    expect(detectReportType('sales by category last month')).toBe(
      'sales-by-category',
    );
    expect(detectReportType('number of categories sold')).toBe(
      'sales-by-category',
    );
    expect(detectReportType('how much cash did we take')).toBe(
      'payment-methods',
    );
    expect(detectReportType('bKash payments this week')).toBe(
      'payment-methods',
    );
    expect(detectReportType('mobile money trend')).toBe('payment-methods');
    expect(detectReportType('top selling items')).toBe('top-products');
    expect(detectReportType('best sellers last week')).toBe('top-products');
    expect(detectReportType('daily revenue summary')).toBe('sales-summary');
    expect(detectReportType('what was our income yesterday')).toBe(
      'sales-summary',
    );
    expect(detectReportType('tell me about the weather')).toBeNull();
  });

  it('applies the pinned priority when several families collide', () => {
    // inventory beats top; category beats sale; payment beats top.
    expect(detectReportType('top products in stock')).toBe(
      'inventory-valuation',
    );
    expect(detectReportType('sales by category')).toBe('sales-by-category');
    expect(detectReportType('top cash collection days')).toBe(
      'payment-methods',
    );
  });
});

describe('matchShopByName', () => {
  it('case-insensitively contains-matches the shop name', () => {
    expect(
      matchShopByName('sales at the DOWNTOWN branch last week', SHOPS),
    ).toEqual({ id: 'shop-2', name: 'Downtown' });
    expect(matchShopByName('revenue at main store today', SHOPS)).toEqual({
      id: 'shop-1',
      name: 'Main Store',
    });
    expect(matchShopByName('sales overall', SHOPS)).toBeNull();
  });

  it('prefers the longest matching shop name', () => {
    const nested: TenantShopOption[] = [
      { id: 's-a', name: 'Main' },
      { id: 's-b', name: 'Main Store' },
    ];
    expect(matchShopByName('sales at Main Store today', nested)?.id).toBe(
      's-b',
    );
  });
});

// ---------------------------------------------------------------------------
// Full parse + interpretation
// ---------------------------------------------------------------------------

describe('parseQuestion / toResolvedSpec', () => {
  it('parses "top 5 products by quantity" into limit=5 sortBy=qty', () => {
    const result = parseQuestion('top 5 products by quantity', {
      shops: SHOPS,
      now: MON_12_OCT,
    });
    const spec = toResolvedSpec(result);
    expect(spec).toEqual<ResolvedReportSpec>({
      reportType: 'top-products',
      from: '2026-09-13',
      to: '2026-10-12',
      shopId: null,
      groupBy: 'day',
      limit: 5,
      sortBy: 'qty',
    });
  });

  it('an explicit shopId overrides names found in the question', () => {
    const result = parseQuestion('sales at Downtown yesterday', {
      shops: SHOPS,
      now: MON_12_OCT,
      explicitShopId: 'shop-1',
    });
    expect(result.shopId).toBe('shop-1');
  });

  it('matches a shop by name when no explicit shopId is given', () => {
    const result = parseQuestion('sales at Downtown yesterday', {
      shops: SHOPS,
      now: MON_12_OCT,
    });
    expect(result.shopId).toBe('shop-2');
    expect(result.range).toEqual({ from: '2026-10-11', to: '2026-10-11' });
  });

  it('returns a null reportType for unresolvable questions', () => {
    const result = parseQuestion('tell me a joke', {
      shops: SHOPS,
      now: MON_12_OCT,
    });
    expect(result.reportType).toBeNull();
    expect(toResolvedSpec(result)).toBeNull();
  });
});

describe('interpretSpec', () => {
  const base: ResolvedReportSpec = {
    reportType: 'top-products',
    from: '2026-09-13',
    to: '2026-10-12',
    shopId: null,
    groupBy: 'day',
    limit: 10,
    sortBy: 'revenue',
  };

  it('renders the contract example sentence', () => {
    expect(interpretSpec(base, null)).toBe(
      'Top products by revenue from 2026-09-13 to 2026-10-12',
    );
  });

  it('renders each report type, with the shop when known', () => {
    expect(
      interpretSpec({ ...base, reportType: 'sales-summary' }, 'Downtown'),
    ).toBe('Sales summary from 2026-09-13 to 2026-10-12 at Downtown');
    expect(
      interpretSpec({ ...base, reportType: 'payment-methods' }, null),
    ).toBe('Payment methods from 2026-09-13 to 2026-10-12');
    expect(
      interpretSpec(
        { ...base, reportType: 'sales-by-category', shopId: 'shop-2' },
        'Downtown',
      ),
    ).toBe('Sales by category from 2026-09-13 to 2026-10-12 at Downtown');
    expect(
      interpretSpec({ ...base, reportType: 'inventory-valuation' }, null),
    ).toBe('Inventory valuation across all shops');
  });
});
