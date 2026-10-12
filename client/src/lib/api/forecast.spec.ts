import { createForecastApi, type ForecastHttp, type ForecastParamValue } from './forecast';
import type { ForecastListResponse, ForecastProductDetail } from '@/types/forecast';

// The forecast api client takes an injectable ForecastHttp, so these specs
// record the (path, params) pairs it produces instead of jest.mock-ing axios.

interface RecordedCall {
  path: string;
  params: Record<string, ForecastParamValue>;
}

function makeFakeHttp(response: unknown) {
  const calls: RecordedCall[] = [];
  const http: ForecastHttp = {
    get: (path, params) => {
      calls.push({ path, params });
      return Promise.resolve(response);
    },
  };
  return { http, calls };
}

const LIST_FIXTURE: ForecastListResponse = {
  horizonDays: 14,
  shopId: null,
  generatedAt: '2026-10-01T09:30:00.000Z',
  rows: [
    {
      productId: 'p1',
      name: 'Coca Cola 500ml',
      sku: 'SKU-001',
      unit: 'pcs',
      avgDailyQty: 2.5,
      forecastQty: 35,
      currentStock: 10,
      daysOfCover: 4,
      risk: 'low',
      suggestedOrderQty: 25,
    },
  ],
  totals: { products: 1, outOfStock: 0, low: 1 },
};

const DETAIL_FIXTURE: ForecastProductDetail = {
  productId: 'p1',
  name: 'Coca Cola 500ml',
  sku: 'SKU-001',
  unit: 'pcs',
  avgDailyQty: 2.5,
  forecastQty: 35,
  currentStock: 10,
  daysOfCover: 4,
  risk: 'low',
  suggestedOrderQty: 25,
  history: [
    { date: '2026-09-01', qtySold: 3 },
    { date: '2026-09-02', qtySold: 0 },
  ],
  forecastSeries: [
    { date: '2026-10-02', expectedQty: 2.5 },
    { date: '2026-10-03', expectedQty: 2.5 },
  ],
};

describe('forecast api client', () => {
  it('serializes the horizon and omits shopId/risk/search when unset', async () => {
    const { http, calls } = makeFakeHttp(LIST_FIXTURE);
    const api = createForecastApi(http);

    const result = await api.list({ horizonDays: 14 });

    expect(calls[0]).toEqual({ path: '/forecast', params: { horizonDays: 14 } });
    expect(result).toBe(LIST_FIXTURE);
  });

  it('sends shopId, risk and search when provided', async () => {
    const { http, calls } = makeFakeHttp(LIST_FIXTURE);
    const api = createForecastApi(http);

    await api.list({ horizonDays: 30, shopId: 'shop-1', risk: 'out_of_stock', search: 'cola' });

    expect(calls[0]).toEqual({
      path: '/forecast',
      params: { horizonDays: 30, shopId: 'shop-1', risk: 'out_of_stock', search: 'cola' },
    });
  });

  it('treats "" shopId/risk/search as omitted (All shops / All / blank search)', async () => {
    const { http, calls } = makeFakeHttp(LIST_FIXTURE);
    const api = createForecastApi(http);

    await api.list({ horizonDays: 7, shopId: '', risk: undefined, search: '' });

    expect(calls[0].params).toEqual({ horizonDays: 7 });
    expect(Object.prototype.hasOwnProperty.call(calls[0].params, 'shopId')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(calls[0].params, 'risk')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(calls[0].params, 'search')).toBe(false);
  });

  it('fetches product detail by id with an optional horizon', async () => {
    const { http, calls } = makeFakeHttp(DETAIL_FIXTURE);
    const api = createForecastApi(http);

    const withHorizon = await api.productDetail('p1', { horizonDays: 14 });
    const withoutHorizon = await api.productDetail('p1');

    expect(calls[0]).toEqual({ path: '/forecast/product/p1', params: { horizonDays: 14 } });
    expect(calls[1]).toEqual({ path: '/forecast/product/p1', params: {} });
    expect(withHorizon).toBe(DETAIL_FIXTURE);
    expect(withoutHorizon).toBe(DETAIL_FIXTURE);
  });

  it('url-encodes the product id path segment', async () => {
    const { http, calls } = makeFakeHttp(DETAIL_FIXTURE);
    const api = createForecastApi(http);

    await api.productDetail('p/1 space');

    expect(calls[0].path).toBe('/forecast/product/p%2F1%20space');
  });

  it('passes through transport errors unchanged', async () => {
    const message = 'Product not found';
    const http: ForecastHttp = {
      get: () => Promise.reject(new Error(message)),
    };
    const api = createForecastApi(http);

    await expect(api.productDetail('missing')).rejects.toThrow(message);
    await expect(api.list({ horizonDays: 14 })).rejects.toThrow(message);
  });
});
