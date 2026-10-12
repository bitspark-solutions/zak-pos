import apiClient from './client';
import type {
  ForecastDetailQuery,
  ForecastListQuery,
  ForecastListResponse,
  ForecastProductDetail,
} from '@/types/forecast';

// Both forecast endpoints go through the shared ApiClient axios instance
// (src/lib/api/client.ts), which attaches the Bearer token via its request
// interceptor and normalises failures into thrown Error with a readable
// message (a 404 from /forecast/product/:id surfaces the server's text in
// err.message — the same contract the reports client relies on).
//
// The transport is injectable: createForecastApi takes a ForecastHttp so
// unit tests can supply a fake recorder instead of jest.mock-ing axios.

export type ForecastParamValue = string | number;

export interface ForecastHttp {
  get(path: string, params: Record<string, ForecastParamValue>): Promise<unknown>;
}

export const apiClientHttp: ForecastHttp = {
  get: (path, params) => apiClient.get(path, { params }).then(res => res.data),
};

// axios drops `undefined` query params, but we filter '' explicitly so a
// cleared search box or "All shops" never serialises as `shopId=`.
function compactParams(
  params: Record<string, ForecastParamValue | undefined>,
): Record<string, ForecastParamValue> {
  const out: Record<string, ForecastParamValue> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

export function createForecastApi(http: ForecastHttp = apiClientHttp) {
  return {
    async list(query: ForecastListQuery): Promise<ForecastListResponse> {
      const res = await http.get(
        '/forecast',
        compactParams({
          horizonDays: query.horizonDays,
          shopId: query.shopId,
          risk: query.risk,
          search: query.search,
        }),
      );
      return res as ForecastListResponse;
    },

    async productDetail(
      productId: string,
      query: ForecastDetailQuery = {},
    ): Promise<ForecastProductDetail> {
      const res = await http.get(
        `/forecast/product/${encodeURIComponent(productId)}`,
        compactParams({ horizonDays: query.horizonDays }),
      );
      return res as ForecastProductDetail;
    },
  };
}

export type ForecastApi = ReturnType<typeof createForecastApi>;

export const forecastApi = createForecastApi();
