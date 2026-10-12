import {
  createReportsApi,
  type ReportsHttp,
  type ReportsParamValue,
} from './reports';
import type { AskReportResult, SalesSummaryReport, TopProductsReport } from '@/types/reports';

// The api client takes an injectable ReportsHttp, so these specs record the
// (path, params) pairs it produces instead of jest.mock-ing the axios layer.

interface RecordedCall {
  kind: 'get' | 'post';
  path: string;
  payload: Record<string, ReportsParamValue> | Record<string, unknown>;
}

function makeFakeHttp(response: unknown) {
  const calls: RecordedCall[] = [];
  const http: ReportsHttp = {
    get: (path, params) => {
      calls.push({ kind: 'get', path, payload: params });
      return Promise.resolve(response);
    },
    post: (path, body) => {
      calls.push({ kind: 'post', path, payload: body });
      return Promise.resolve(response);
    },
  };
  return { http, calls };
}

const SALES_SUMMARY_FIXTURE: SalesSummaryReport = {
  reportType: 'sales-summary',
  from: '2026-09-01',
  to: '2026-09-30',
  shopId: null,
  groupBy: 'day',
  rows: [
    { period: '2026-09-01', grossSales: 1000, discount: 50, tax: 80, netSales: 950, txCount: 7 },
  ],
  totals: { grossSales: 1000, discount: 50, tax: 80, netSales: 950, txCount: 7 },
};

const TOP_PRODUCTS_FIXTURE: TopProductsReport = {
  reportType: 'top-products',
  from: '2026-09-01',
  to: '2026-09-07',
  shopId: null,
  limit: 5,
  sortBy: 'qty',
  rows: [{ productId: 'p1', name: 'Coca Cola 500ml', sku: 'SKU-1', qtySold: 42, revenue: 2940 }],
};

describe('reports api client', () => {
  it('serializes sales-summary with from/to/groupBy and omits shopId for all shops', async () => {
    const { http, calls } = makeFakeHttp(SALES_SUMMARY_FIXTURE);
    const api = createReportsApi(http);

    const result = await api.salesSummary({ from: '2026-09-01', to: '2026-09-30', groupBy: 'day' });

    expect(calls[0]).toEqual({
      kind: 'get',
      path: '/reports/sales-summary',
      payload: { from: '2026-09-01', to: '2026-09-30', groupBy: 'day' },
    });
    expect(result).toBe(SALES_SUMMARY_FIXTURE);
  });

  it('includes shopId when a specific shop is selected (and treats "" as all shops)', async () => {
    const { http, calls } = makeFakeHttp(SALES_SUMMARY_FIXTURE);
    const api = createReportsApi(http);

    await api.salesSummary({ from: '2026-09-01', to: '2026-09-30', shopId: 'shop-1', groupBy: 'week' });
    await api.salesSummary({ from: '2026-09-01', to: '2026-09-30', shopId: '', groupBy: 'month' });

    expect(calls[0].payload).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      groupBy: 'week',
      shopId: 'shop-1',
    });
    expect(Object.prototype.hasOwnProperty.call(calls[1].payload, 'shopId')).toBe(false);
  });

  it('sends limit and sortBy for top-products', async () => {
    const { http, calls } = makeFakeHttp({ reportType: 'top-products', rows: [] });
    const api = createReportsApi(http);

    await api.topProducts({ from: '2026-09-01', to: '2026-09-07', limit: 5, sortBy: 'qty' });

    expect(calls[0]).toEqual({
      kind: 'get',
      path: '/reports/top-products',
      payload: { from: '2026-09-01', to: '2026-09-07', limit: 5, sortBy: 'qty' },
    });
  });

  it('fetches sales-by-category and payment-methods with the date range only', async () => {
    const { http, calls } = makeFakeHttp({ rows: [] });
    const api = createReportsApi(http);

    await api.salesByCategory({ from: '2026-08-01', to: '2026-08-31' });
    await api.paymentMethods({ from: '2026-08-01', to: '2026-08-31', shopId: 'shop-9' });

    expect(calls[0]).toEqual({
      kind: 'get',
      path: '/reports/sales-by-category',
      payload: { from: '2026-08-01', to: '2026-08-31' },
    });
    expect(calls[1]).toEqual({
      kind: 'get',
      path: '/reports/payment-methods',
      payload: { from: '2026-08-01', to: '2026-08-31', shopId: 'shop-9' },
    });
  });

  it('sends no date params for inventory-valuation', async () => {
    const { http, calls } = makeFakeHttp({ reportType: 'inventory-valuation', rows: [], totals: { quantityOnHand: 0, valuation: 0 } });
    const api = createReportsApi(http);

    await api.inventoryValuation({});

    expect(calls[0]).toEqual({ kind: 'get', path: '/reports/inventory-valuation', payload: {} });
  });

  it('posts the question (and optional shopId) to /reports/ask and returns the parsed result', async () => {
    const askResult: AskReportResult = {
      interpretation: 'Top 5 products by quantity, last week',
      engine: 'keyword',
      report: TOP_PRODUCTS_FIXTURE,
    };
    const { http, calls } = makeFakeHttp(askResult);
    const api = createReportsApi(http);

    const result = await api.ask({ question: 'top 5 products by quantity last week' });

    expect(calls[0]).toEqual({
      kind: 'post',
      path: '/reports/ask',
      payload: { question: 'top 5 products by quantity last week' },
    });
    expect(result).toBe(askResult);
    expect(result.report.reportType).toBe('top-products');
  });

  it('includes shopId in the ask body when provided', async () => {
    const { http, calls } = makeFakeHttp({ interpretation: '', engine: 'llm' });
    const api = createReportsApi(http);

    await api.ask({ question: 'how much did we sell', shopId: 'shop-2' });

    expect(calls[0].payload).toEqual({ question: 'how much did we sell', shopId: 'shop-2' });
  });
});
