import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ForecastView } from './page';
import type { ForecastApi } from '@/lib/api/forecast';
import type { Shop } from '@/types/admin';
import type { ForecastListResponse, ForecastProductDetail } from '@/types/forecast';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/useAuth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockUseRouter = jest.mocked(useRouter);

const LIST: ForecastListResponse = {
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
    {
      productId: 'p2',
      name: 'Mineral Water 1L',
      sku: 'SKU-002',
      unit: 'pcs',
      avgDailyQty: 0,
      forecastQty: 0,
      currentStock: 500,
      daysOfCover: null,
      risk: 'overstock',
      suggestedOrderQty: 0,
    },
  ],
  totals: { products: 2, outOfStock: 0, low: 1 },
};

const DETAIL: ForecastProductDetail = {
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

const SHOPS: Shop[] = [
  { id: 's1', tenantId: 't1', name: 'Main Store' },
  { id: 's2', tenantId: 't1', name: 'Uttara Branch' },
];

function makeFakeForecast(): jest.Mocked<ForecastApi> {
  return {
    list: jest.fn().mockResolvedValue(LIST),
    productDetail: jest.fn().mockResolvedValue(DETAIL),
  };
}

function mockOwnerAuth(): void {
  mockUseAuth.mockReturnValue({
    user: {
      id: 'u1',
      email: 'owner@example.com',
      name: 'Shop Owner',
      role: 'owner',
      tenantId: 't1',
      permissions: ['report:read'],
    },
    token: 'valid-token',
    isAuthenticated: true,
    isLoading: false,
    error: null,
    login: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
    refreshToken: jest.fn(),
    hasPermission: () => true,
    hasRole: (role: string) => role === 'owner',
    clearError: jest.fn(),
  });
  mockUseRouter.mockReturnValue({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  } as unknown as ReturnType<typeof useRouter>);
}

function renderView(
  forecast: jest.Mocked<ForecastApi>,
  listShops = jest.fn().mockResolvedValue(SHOPS),
) {
  return render(<ForecastView forecast={forecast} listShops={listShops} />);
}

/** Waits for the list request that satisfies the predicate (any call). */
async function waitForListCall(
  forecast: jest.Mocked<ForecastApi>,
  predicate: (query: Parameters<ForecastApi['list']>[0]) => boolean,
): Promise<void> {
  await waitFor(() => {
    const matched = forecast.list.mock.calls.some(([query]) => predicate(query));
    if (!matched) throw new Error('no matching list call yet');
  });
}

describe('Forecast page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwnerAuth();
  });

  it('renders the title, horizon default, shop selector and risk chips', () => {
    renderView(makeFakeForecast());

    expect(screen.getByRole('heading', { name: 'Stock Forecasting' })).toBeInTheDocument();
    expect(screen.getByLabelText('Horizon')).toHaveValue('14');
    for (const option of ['7 days', '14 days', '30 days', '60 days']) {
      expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Shop')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'All shops' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search products')).toBeInTheDocument();

    const group = screen.getByRole('group', { name: 'Risk filter' });
    for (const label of ['All', 'Out of stock', 'Low', 'OK', 'Overstock']) {
      expect(within(group).getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(within(group).getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('fetches the list on mount with the default horizon and no optional params', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);

    await waitFor(() => expect(forecast.list).toHaveBeenCalled());
    expect(forecast.list).toHaveBeenCalledWith({ horizonDays: 14 });
  });

  it('renders forecast rows with 3dp/1dp quantities and colour-coded risk badges', async () => {
    renderView(makeFakeForecast());

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);

    const [first, second] = rows as [HTMLTableRowElement, HTMLTableRowElement];
    expect(within(first).getByText('Coca Cola 500ml')).toBeInTheDocument();
    expect(within(first).getByText('SKU-001')).toBeInTheDocument();
    expect(within(first).getByText('2.500')).toBeInTheDocument(); // avgDailyQty 3dp
    expect(within(first).getByText('35.0')).toBeInTheDocument(); // forecastQty 1dp
    expect(within(first).getByText('4.0d')).toBeInTheDocument(); // daysOfCover 1dp + d
    expect(within(first).getByText('Low')).toBeInTheDocument();

    // suggestedOrderQty > 0 renders bold; 0 does not.
    expect(within(first).getByText('25').closest('strong')).not.toBeNull();
    expect(within(second).getByText('0').closest('strong')).toBeNull();
  });

  it('renders an em dash for null daysOfCover', async () => {
    renderView(makeFakeForecast());

    const table = await screen.findByRole('table');
    const second = within(table).getAllByRole('row')[2] as HTMLTableRowElement;
    expect(within(second).getByText('—')).toBeInTheDocument();
    expect(within(second).getByText('Overstock')).toBeInTheDocument();
  });

  it('shows the totals summary strip and the generated-at timestamp', async () => {
    renderView(makeFakeForecast());

    const strip = await screen.findByLabelText('Forecast summary');
    expect(within(strip).getByText('2')).toBeInTheDocument(); // products
    expect(within(strip).getByText('0')).toBeInTheDocument(); // outOfStock
    expect(within(strip).getByText('1')).toBeInTheDocument(); // low
    const expected = `Generated at ${new Date('2026-10-01T09:30:00.000Z').toLocaleString()}`;
    expect(within(strip).getByText(expected)).toBeInTheDocument();
  });

  it('sends the risk chip value as the risk param and omits it for All', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);
    await waitForListCall(forecast, query => query.horizonDays === 14);

    fireEvent.click(screen.getByRole('button', { name: 'Low' }));
    await waitForListCall(forecast, query => query.risk === 'low');
    expect(forecast.list).toHaveBeenCalledWith({ horizonDays: 14, risk: 'low' });

    fireEvent.click(screen.getByRole('button', { name: 'Out of stock' }));
    await waitForListCall(forecast, query => query.risk === 'out_of_stock');

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => {
      const last = forecast.list.mock.calls[forecast.list.mock.calls.length - 1];
      expect(last?.[0]).toEqual({ horizonDays: 14 });
    });
  });

  it('re-fetches with horizonDays and shopId when the selects change', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);

    await screen.findByRole('option', { name: 'Uttara Branch' });
    fireEvent.change(screen.getByLabelText('Horizon'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Shop'), { target: { value: 's2' } });

    await waitForListCall(forecast, query => query.horizonDays === 30 && query.shopId === 's2');
  });

  it('debounces the search box before sending the search param', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);
    await waitForListCall(forecast, query => query.horizonDays === 14);

    const callsBefore = forecast.list.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'cola' } });

    // Not fired synchronously — the 300ms debounce has to elapse first.
    expect(forecast.list.mock.calls.length).toBe(callsBefore);

    await waitForListCall(forecast, query => query.search === 'cola');
  });

  it('clicking a row lazy-fetches the detail and renders both chart series', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);

    const table = await screen.findByRole('table');
    const first = within(table).getAllByRole('row')[1] as HTMLTableRowElement;
    fireEvent.click(first);

    await waitFor(() =>
      expect(forecast.productDetail).toHaveBeenCalledWith('p1', { horizonDays: 14 }),
    );

    expect(await screen.findByText('28-day demand history')).toBeInTheDocument();
    expect(screen.getByText('Next 14-day forecast')).toBeInTheDocument();
    // History bars (MM-DD labels) and forecast bars.
    expect(screen.getByText('09-01')).toBeInTheDocument();
    expect(screen.getByText('09-02')).toBeInTheDocument();
    expect(screen.getByText('10-02')).toBeInTheDocument();
    expect(screen.getByText('10-03')).toBeInTheDocument();
    // Bar value labels use the 1dp formatter.
    expect(screen.getAllByText('2.5').length).toBeGreaterThanOrEqual(2);
    // Per-product summary fields inside the panel (label appears once in the
    // table header and once in the detail panel).
    expect(screen.getAllByText('Days of cover')).toHaveLength(2);
  });

  it('keeps a single row expanded at a time and collapses on a second click', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1) as HTMLTableRowElement[];

    fireEvent.click(rows[0]);
    await screen.findByText('28-day demand history');

    fireEvent.click(rows[1]);
    await waitFor(() =>
      expect(forecast.productDetail).toHaveBeenCalledWith('p2', { horizonDays: 14 }),
    );
    expect(screen.getAllByText('28-day demand history')).toHaveLength(1);
    expect(screen.getByText('09-01')).toBeInTheDocument(); // now p2's detail (same fixture)

    fireEvent.click(rows[1]);
    await waitFor(() =>
      expect(within(table).queryByText('28-day demand history')).not.toBeInTheDocument(),
    );
  });

  it('surfaces a failed detail fetch inside the expanded panel', async () => {
    const forecast = makeFakeForecast();
    forecast.productDetail.mockRejectedValue(new Error('Product not found'));
    renderView(forecast);

    const table = await screen.findByRole('table');
    const first = within(table).getAllByRole('row')[1] as HTMLTableRowElement;
    fireEvent.click(first);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Product not found');
    expect(screen.queryByText('28-day demand history')).not.toBeInTheDocument();
  });

  it('shows the empty message when no rows match the filter', async () => {
    const forecast = makeFakeForecast();
    forecast.list.mockResolvedValue({ ...LIST, rows: [] });
    renderView(forecast);

    expect(await screen.findByText('No products match this filter')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the server message in an error banner when the list fetch fails', async () => {
    const forecast = makeFakeForecast();
    forecast.list.mockRejectedValue(new Error('Forecast service unavailable'));
    renderView(forecast);

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Forecast service unavailable');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('re-fetches the list when Refresh is clicked', async () => {
    const forecast = makeFakeForecast();
    renderView(forecast);
    // Wait until the first page actually rendered — the button is disabled
    // while the initial fetch is in flight.
    await screen.findByRole('table');
    expect(forecast.list).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(forecast.list).toHaveBeenCalledTimes(2));
    expect(forecast.list).toHaveBeenLastCalledWith({ horizonDays: 14 });
  });

  it('degrades gracefully when the shops api fails', async () => {
    const forecast = makeFakeForecast();
    const listShops = jest.fn().mockRejectedValue(new Error('shops down'));
    renderView(forecast, listShops);

    expect(await screen.findByText(/Could not load shops/)).toBeInTheDocument();
    // The forecast table still loads.
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
