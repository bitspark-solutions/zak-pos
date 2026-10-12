import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ReportsView } from './page';
import type { ReportsApi } from '@/lib/api/reports';
import type { Shop } from '@/types/admin';
import type {
  InventoryValuationReport,
  PaymentMethodsReport,
  SalesByCategoryReport,
  SalesSummaryReport,
  TopProductsReport,
} from '@/types/reports';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

jest.mock('@/hooks/useAuth');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockUseRouter = jest.mocked(useRouter);

const SALES_SUMMARY: SalesSummaryReport = {
  reportType: 'sales-summary',
  from: '2026-09-01',
  to: '2026-09-30',
  shopId: null,
  groupBy: 'day',
  rows: [
    { period: '2026-09-14', grossSales: 1200, discount: 100, tax: 96, netSales: 1104, txCount: 12 },
    { period: '2026-09-15', grossSales: 500, discount: 0, tax: 40, netSales: 460, txCount: 5 },
  ],
  totals: { grossSales: 1700, discount: 100, tax: 136, netSales: 1564, txCount: 17 },
};

const TOP_PRODUCTS: TopProductsReport = {
  reportType: 'top-products',
  from: '2026-09-01',
  to: '2026-09-30',
  shopId: null,
  limit: 10,
  sortBy: 'revenue',
  rows: [
    { productId: 'p1', name: 'Coca Cola 500ml', sku: 'SKU-001', qtySold: 42, revenue: 2940 },
    { productId: 'p2', name: 'Mineral Water 1L', sku: 'SKU-002', qtySold: 30, revenue: 1500 },
  ],
};

const INVENTORY_VALUATION: InventoryValuationReport = {
  reportType: 'inventory-valuation',
  shopId: null,
  rows: [
    {
      productId: 'p1',
      name: 'Coca Cola 500ml',
      sku: 'SKU-001',
      shopId: 's1',
      shopName: 'Main Store',
      quantityOnHand: 250,
      avgCost: 45,
      valuation: 11250,
    },
  ],
  totals: { quantityOnHand: 300, valuation: 13500 },
};

const SALES_BY_CATEGORY: SalesByCategoryReport = {
  reportType: 'sales-by-category',
  from: '2026-09-01',
  to: '2026-09-30',
  shopId: null,
  rows: [{ categoryId: null, categoryName: 'Uncategorised', qtySold: 3, revenue: 210 }],
};

const PAYMENT_METHODS: PaymentMethodsReport = {
  reportType: 'payment-methods',
  from: '2026-09-01',
  to: '2026-09-30',
  shopId: null,
  rows: [{ method: 'cash', count: 9, amount: 4500.5 }],
};

const SHOPS: Shop[] = [
  { id: 's1', tenantId: 't1', name: 'Main Store' },
  { id: 's2', tenantId: 't1', name: 'Uttara Branch' },
];

function makeFakeReports(): jest.Mocked<ReportsApi> {
  return {
    salesSummary: jest.fn(),
    topProducts: jest.fn(),
    salesByCategory: jest.fn(),
    paymentMethods: jest.fn(),
    inventoryValuation: jest.fn(),
    ask: jest.fn(),
  };
}

/** Expected default range: the trailing 30 days ending today (local time). */
function expectedRange(): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: iso(from), to: iso(to) };
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

function renderView(reports: jest.Mocked<ReportsApi>, listShops = jest.fn().mockResolvedValue(SHOPS)) {
  return render(<ReportsView reports={reports} listShops={listShops} />);
}

describe('Reports page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOwnerAuth();
  });

  it('shows the ask box, filter controls and five preset report cards', () => {
    renderView(makeFakeReports());

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask in plain English/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ask$/ })).toBeDisabled();
    expect(screen.getByLabelText('From')).toBeInTheDocument();
    expect(screen.getByLabelText('To')).toBeInTheDocument();
    expect(screen.getByLabelText('Shop')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'All shops' })).toBeInTheDocument();

    for (const label of ['Sales Summary', 'Top Products', 'Sales by Category', 'Payment Methods', 'Inventory Valuation']) {
      expect(screen.getByRole('button', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('loads shops through the injected shops api and lists them in the selector', async () => {
    const listShops = jest.fn().mockResolvedValue(SHOPS);
    renderView(makeFakeReports(), listShops);

    await waitFor(() => expect(listShops).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: 'Uttara Branch' })).toBeInTheDocument();
  });

  it('runs the sales summary report with the default last-30-days range', async () => {
    const reports = makeFakeReports();
    reports.salesSummary.mockResolvedValue(SALES_SUMMARY);
    renderView(reports);

    fireEvent.click(screen.getByRole('button', { name: /Sales Summary/i }));

    await waitFor(() =>
      expect(reports.salesSummary).toHaveBeenCalledWith({
        ...expectedRange(),
        groupBy: 'day',
      }),
    );

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('cell', { name: '2026-09-14' })).toBeInTheDocument();
    expect(within(table).getByText('BDT 1,104.00')).toBeInTheDocument();
    // Totals row carries the grand total (distinct from any single row).
    expect(within(table).getByRole('cell', { name: 'Total' })).toBeInTheDocument();
    expect(within(table).getByText('BDT 1,564.00')).toBeInTheDocument();
    // Chart also renders the net-sales value (table cell + svg text).
    expect(screen.getAllByText('BDT 1,104.00').length).toBeGreaterThanOrEqual(2);
    // Per-report extra appears once the card is active.
    expect(screen.getByLabelText('Group by')).toHaveValue('day');
  });

  it('omits shopId for All shops and sends it when a shop is selected', async () => {
    const reports = makeFakeReports();
    reports.paymentMethods.mockResolvedValue(PAYMENT_METHODS);
    renderView(reports);

    // Wait until the shops list has actually loaded before selecting.
    await screen.findByRole('option', { name: 'Uttara Branch' });
    const shopSelect = screen.getByLabelText('Shop');
    fireEvent.change(shopSelect, { target: { value: 's1' } });
    expect(shopSelect).toHaveValue('s1');
    fireEvent.click(screen.getByRole('button', { name: /Payment Methods/i }));

    await waitFor(() =>
      expect(reports.paymentMethods).toHaveBeenCalledWith(
        expect.objectContaining({ shopId: 's1' }),
      ),
    );
    const table = await screen.findByRole('table');
    expect(within(table).getByText('BDT 4,500.50')).toBeInTheDocument();
  });

  it('sends limit and sortBy extras for top products', async () => {
    const reports = makeFakeReports();
    reports.topProducts.mockResolvedValue(TOP_PRODUCTS);
    renderView(reports);

    fireEvent.click(screen.getByRole('button', { name: /Top Products/i }));
    await screen.findByLabelText('Sort by');

    fireEvent.change(screen.getByLabelText('Top'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'qty' } });
    fireEvent.click(screen.getByRole('button', { name: /Top Products/i }));

    await waitFor(() =>
      expect(reports.topProducts).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, sortBy: 'qty' }),
      ),
    );

    const table = await screen.findByRole('table');
    expect(within(table).getByText('Coca Cola 500ml')).toBeInTheDocument();
    expect(within(table).getByText('SKU-001')).toBeInTheDocument();
  });

  it('hides the date controls for inventory valuation and ignores them in the request', async () => {
    const reports = makeFakeReports();
    reports.inventoryValuation.mockResolvedValue(INVENTORY_VALUATION);
    renderView(reports);

    expect(screen.getByLabelText('From')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Inventory Valuation/i }));

    await waitFor(() => expect(reports.inventoryValuation).toHaveBeenCalledWith({}));
    expect(screen.queryByLabelText('From')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('To')).not.toBeInTheDocument();

    const table = await screen.findByRole('table');
    expect(within(table).getByText('BDT 11,250.00')).toBeInTheDocument();
    expect(within(table).getByText('BDT 13,500.00')).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Total' })).toBeInTheDocument();
  });

  it('shows the "No sales in this range" empty state when rows come back empty', async () => {
    const reports = makeFakeReports();
    reports.salesByCategory.mockResolvedValue({ ...SALES_BY_CATEGORY, rows: [] });
    renderView(reports);

    fireEvent.click(screen.getByRole('button', { name: /Sales by Category/i }));

    expect(await screen.findByText('No sales in this range')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders the interpretation banner with engine badge and resolved report after asking', async () => {
    const reports = makeFakeReports();
    reports.ask.mockResolvedValue({
      interpretation: 'Top products by quantity sold from 2026-09-23 to 2026-09-29',
      engine: 'keyword',
      report: { ...TOP_PRODUCTS, sortBy: 'qty' },
    });
    renderView(reports);

    fireEvent.change(screen.getByPlaceholderText(/Ask in plain English/i), {
      target: { value: 'top 5 products by quantity last week' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/ }));

    expect(
      await screen.findByText('Top products by quantity sold from 2026-09-23 to 2026-09-29'),
    ).toBeInTheDocument();
    expect(screen.getByText('keyword')).toBeInTheDocument();
    expect(reports.ask).toHaveBeenCalledWith({
      question: 'top 5 products by quantity last week',
    });

    // The resolved report renders like a preset one — chart + table row.
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Coca Cola 500ml')).toBeInTheDocument();
    expect(within(table).getByText('BDT 2,940.00')).toBeInTheDocument();
    // Chart value text is present too.
    expect(screen.getAllByText('BDT 2,940.00').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the server 400 message listing supported topics in an error banner', async () => {
    const reports = makeFakeReports();
    reports.ask.mockRejectedValue(
      new Error(
        'Could not map the question to a report. Supported topics: sales-summary, top-products, sales-by-category, payment-methods, inventory-valuation',
      ),
    );
    renderView(reports);

    fireEvent.change(screen.getByPlaceholderText(/Ask in plain English/i), {
      target: { value: 'who is the best cashier' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Ask$/ }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Supported topics');
    expect(banner).toHaveTextContent('inventory-valuation');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('surfaces report fetch failures in the error banner', async () => {
    const reports = makeFakeReports();
    reports.salesSummary.mockRejectedValue(new Error('Network error. Please check your connection and try again.'));
    renderView(reports);

    fireEvent.click(screen.getByRole('button', { name: /Sales Summary/i }));

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent('Network error');
  });

  it('trims whitespace and keeps Ask disabled for blank questions', async () => {
    const reports = makeFakeReports();
    reports.ask.mockResolvedValue({
      interpretation: 'Net sales per day from 2026-09-23 to 2026-09-29',
      engine: 'llm',
      report: SALES_SUMMARY,
    });
    renderView(reports);

    const input = screen.getByPlaceholderText(/Ask in plain English/i);
    const askButton = screen.getByRole('button', { name: /^Ask$/ });

    fireEvent.change(input, { target: { value: '   ' } });
    expect(askButton).toBeDisabled();
    fireEvent.click(askButton);
    expect(reports.ask).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '  how much did we sell last week  ' } });
    expect(askButton).toBeEnabled();
    fireEvent.click(askButton);
    await waitFor(() =>
      expect(reports.ask).toHaveBeenCalledWith({ question: 'how much did we sell last week' }),
    );
    expect(await screen.findByText('llm')).toBeInTheDocument();
  });

  it('degrades gracefully when the shops api fails', async () => {
    const reports = makeFakeReports();
    reports.paymentMethods.mockResolvedValue(PAYMENT_METHODS);
    const listShops = jest.fn().mockRejectedValue(new Error('shops down'));
    renderView(reports, listShops);

    expect(await screen.findByText(/Could not load shops/)).toBeInTheDocument();
    // Preset reports still work.
    fireEvent.click(screen.getByRole('button', { name: /Payment Methods/i }));
    await waitFor(() => expect(reports.paymentMethods).toHaveBeenCalled());
  });
});
