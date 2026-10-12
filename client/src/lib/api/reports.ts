import apiClient from './client';
import type {
  AskQuery,
  AskReportResult,
  DateRangeQuery,
  InventoryValuationQuery,
  InventoryValuationReport,
  PaymentMethodsQuery,
  PaymentMethodsReport,
  SalesByCategoryQuery,
  SalesByCategoryReport,
  SalesSummaryQuery,
  SalesSummaryReport,
  TopProductsQuery,
  TopProductsReport,
} from '@/types/reports';

// All report endpoints go through the shared ApiClient axios instance
// (src/lib/api/client.ts), which attaches the Bearer token via its request
// interceptor and normalises failures into thrown Error with a readable
// message (a 400 from /reports/ask surfaces the server's "supported topics"
// text in err.message).
//
// The transport is injectable: createReportsApi takes a ReportsHttp so unit
// tests can supply a fake recorder instead of jest.mock-ing axios.

export type ReportsParamValue = string | number;

export interface ReportsHttp {
  get(path: string, params: Record<string, ReportsParamValue>): Promise<unknown>;
  post(path: string, body: Record<string, unknown>): Promise<unknown>;
}

export const apiClientHttp: ReportsHttp = {
  get: (path, params) => apiClient.get(path, { params }).then(res => res.data),
  post: (path, body) => apiClient.post(path, body).then(res => res.data),
};

// axios drops `undefined` query params, but we filter explicitly so the
// serialized request never carries an empty shopId (= "All shops").
function compactParams(
  params: Record<string, ReportsParamValue | undefined>,
): Record<string, ReportsParamValue> {
  const out: Record<string, ReportsParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

function shopParam(query: { shopId?: string }): Record<string, ReportsParamValue> {
  // Normalise the UI's '' (All shops) and undefined to "omit the param".
  return query.shopId ? { shopId: query.shopId } : {};
}

export function createReportsApi(http: ReportsHttp = apiClientHttp) {
  return {
    async salesSummary(query: SalesSummaryQuery): Promise<SalesSummaryReport> {
      const params: DateRangeQuery & { groupBy: SalesSummaryQuery['groupBy'] } = {
        from: query.from,
        to: query.to,
        groupBy: query.groupBy,
      };
      const res = await http.get(
        '/reports/sales-summary',
        compactParams({ ...params, ...shopParam(query) }),
      );
      return res as SalesSummaryReport;
    },

    async topProducts(query: TopProductsQuery): Promise<TopProductsReport> {
      const res = await http.get(
        '/reports/top-products',
        compactParams({
          from: query.from,
          to: query.to,
          limit: query.limit,
          sortBy: query.sortBy,
          ...shopParam(query),
        }),
      );
      return res as TopProductsReport;
    },

    async salesByCategory(query: SalesByCategoryQuery): Promise<SalesByCategoryReport> {
      const res = await http.get(
        '/reports/sales-by-category',
        compactParams({ from: query.from, to: query.to, ...shopParam(query) }),
      );
      return res as SalesByCategoryReport;
    },

    async paymentMethods(query: PaymentMethodsQuery): Promise<PaymentMethodsReport> {
      const res = await http.get(
        '/reports/payment-methods',
        compactParams({ from: query.from, to: query.to, ...shopParam(query) }),
      );
      return res as PaymentMethodsReport;
    },

    async inventoryValuation(query: InventoryValuationQuery): Promise<InventoryValuationReport> {
      const res = await http.get('/reports/inventory-valuation', compactParams(shopParam(query)));
      return res as InventoryValuationReport;
    },

    async ask(input: AskQuery): Promise<AskReportResult> {
      const res = await http.post('/reports/ask', compactBody(input));
      return res as AskReportResult;
    },
  };
}

// Optional body keys are omitted rather than sent as undefined, matching the
// pinned contract ({ question, shopId? }).
function compactBody(input: AskQuery): Record<string, unknown> {
  const body: Record<string, unknown> = { question: input.question };
  if (input.shopId) body.shopId = input.shopId;
  return body;
}

export type ReportsApi = ReturnType<typeof createReportsApi>;

export const reportsApi = createReportsApi();
