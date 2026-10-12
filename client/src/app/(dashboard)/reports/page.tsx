'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { BarChart, type BarChartRow } from '@/components/reports/BarChart';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api/admin';
import { reportsApi, type ReportsApi } from '@/lib/api/reports';
import type { Shop } from '@/types/admin';
import type {
  AnyReport,
  AskEngine,
  InventoryValuationReport,
  PaymentMethodsReport,
  ReportType,
  SalesByCategoryReport,
  SalesGroupBy,
  SalesSummaryReport,
  TopProductsReport,
  TopProductsSortBy,
} from '@/types/reports';
import { formatBdt, formatCount } from '@/types/reports';
import styles from './page.module.css';

const ASK_QUESTION_MAX_LENGTH = 500;
const DEFAULT_TOP_PRODUCTS_LIMIT = 10;
const TOP_PRODUCTS_LIMIT_MIN = 1;
const TOP_PRODUCTS_LIMIT_MAX = 100;

interface PresetCard {
  type: ReportType;
  label: string;
  description: string;
}

const PRESET_CARDS: PresetCard[] = [
  { type: 'sales-summary', label: 'Sales Summary', description: 'Net sales per period with totals' },
  { type: 'top-products', label: 'Top Products', description: 'Best sellers by revenue or quantity' },
  { type: 'sales-by-category', label: 'Sales by Category', description: 'Revenue split across categories' },
  { type: 'payment-methods', label: 'Payment Methods', description: 'Cash / card split of takings' },
  { type: 'inventory-valuation', label: 'Inventory Valuation', description: 'Stock on hand valued at avg cost' },
];

/** True for the report kinds that ignore the date range. */
function isDateless(type: ReportType | null): boolean {
  return type === 'inventory-valuation';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** yyyy-mm-dd from local date parts (toISOString would drift a day pre-UTC). */
function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Default control state: the trailing 30 days ending today. */
function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: toDateString(from), to: toDateString(to) };
}

function chartRowsFor(report: AnyReport): BarChartRow[] {
  switch (report.reportType) {
    case 'sales-summary':
      return report.rows.map(row => ({ label: row.period, value: row.netSales }));
    case 'top-products':
      return report.rows.map(row => ({ label: row.name, value: row.revenue }));
    case 'sales-by-category':
      return report.rows.map(row => ({ label: row.categoryName, value: row.revenue }));
    case 'payment-methods':
      return report.rows.map(row => ({ label: row.method, value: row.amount }));
    case 'inventory-valuation':
      return report.rows.map(row => ({ label: row.name, value: row.valuation }));
  }
}

function parseLimit(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_TOP_PRODUCTS_LIMIT;
  return Math.min(TOP_PRODUCTS_LIMIT_MAX, Math.max(TOP_PRODUCTS_LIMIT_MIN, Math.trunc(value)));
}

/** Money/integer cell helpers keep the tables aligned with formatBdt. */
function money(value: number): string {
  return formatBdt(value);
}

function emptyMessageFor(type: ReportType): string {
  return type === 'inventory-valuation' ? 'No stock on hand to value.' : 'No sales in this range';
}

// --------------------------------------------------------------------------
// Result rendering — one table + chart per reportType, discriminated on
// report.reportType (the same union POST /reports/ask returns).
// --------------------------------------------------------------------------

function SalesSummaryTable({ report }: { report: SalesSummaryReport }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Period</th>
          <th>Gross sales</th>
          <th>Discount</th>
          <th>Tax</th>
          <th>Net sales</th>
          <th>Transactions</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={row.period}>
            <td>{row.period}</td>
            <td className={styles.cellNumber}>{money(row.grossSales)}</td>
            <td className={styles.cellNumber}>{money(row.discount)}</td>
            <td className={styles.cellNumber}>{money(row.tax)}</td>
            <td className={styles.cellNumber}>{money(row.netSales)}</td>
            <td className={styles.cellNumber}>{formatCount(row.txCount)}</td>
          </tr>
        ))}
        <tr className={styles.totalsRow}>
          <td>Total</td>
          <td className={styles.cellNumber}>{money(report.totals.grossSales)}</td>
          <td className={styles.cellNumber}>{money(report.totals.discount)}</td>
          <td className={styles.cellNumber}>{money(report.totals.tax)}</td>
          <td className={styles.cellNumber}>{money(report.totals.netSales)}</td>
          <td className={styles.cellNumber}>{formatCount(report.totals.txCount)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function TopProductsTable({ report }: { report: TopProductsReport }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>#</th>
          <th>Product</th>
          <th>SKU</th>
          <th>Qty sold</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map((row, index) => (
          <tr key={row.productId}>
            <td>{index + 1}</td>
            <td>{row.name}</td>
            <td>{row.sku || '—'}</td>
            <td className={styles.cellNumber}>{formatCount(row.qtySold)}</td>
            <td className={styles.cellNumber}>{money(row.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SalesByCategoryTable({ report }: { report: SalesByCategoryReport }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Category</th>
          <th>Qty sold</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={row.categoryId ?? 'uncategorised'}>
            <td>{row.categoryName}</td>
            <td className={styles.cellNumber}>{formatCount(row.qtySold)}</td>
            <td className={styles.cellNumber}>{money(row.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PaymentMethodsTable({ report }: { report: PaymentMethodsReport }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Method</th>
          <th>Transactions</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={row.method}>
            <td>{row.method}</td>
            <td className={styles.cellNumber}>{formatCount(row.count)}</td>
            <td className={styles.cellNumber}>{money(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InventoryValuationTable({ report }: { report: InventoryValuationReport }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Product</th>
          <th>SKU</th>
          <th>Shop</th>
          <th>Qty on hand</th>
          <th>Avg cost</th>
          <th>Valuation</th>
        </tr>
      </thead>
      <tbody>
        {report.rows.map(row => (
          <tr key={`${row.productId}-${row.shopId}`}>
            <td>{row.name}</td>
            <td>{row.sku || '—'}</td>
            <td>{row.shopName}</td>
            <td className={styles.cellNumber}>{formatCount(row.quantityOnHand)}</td>
            <td className={styles.cellNumber}>{money(row.avgCost)}</td>
            <td className={styles.cellNumber}>{money(row.valuation)}</td>
          </tr>
        ))}
        <tr className={styles.totalsRow}>
          <td>Total</td>
          <td></td>
          <td></td>
          <td className={styles.cellNumber}>{formatCount(report.totals.quantityOnHand)}</td>
          <td></td>
          <td className={styles.cellNumber}>{money(report.totals.valuation)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function ReportTable({ report }: { report: AnyReport }) {
  switch (report.reportType) {
    case 'sales-summary':
      return <SalesSummaryTable report={report} />;
    case 'top-products':
      return <TopProductsTable report={report} />;
    case 'sales-by-category':
      return <SalesByCategoryTable report={report} />;
    case 'payment-methods':
      return <PaymentMethodsTable report={report} />;
    case 'inventory-valuation':
      return <InventoryValuationTable report={report} />;
  }
}

function ReportResult({ report }: { report: AnyReport }) {
  const chartRows = chartRowsFor(report);
  return (
    <div className={styles.result}>
      {chartRows.length === 0 ? (
        <p className={styles.empty}>{emptyMessageFor(report.reportType)}</p>
      ) : (
        <>
          <div className={styles.chart}>
            <BarChart rows={chartRows} formatter={formatBdt} ariaLabel={`${report.reportType} chart`} />
          </div>
          <div className={styles.tableWrapper}>
            <ReportTable report={report} />
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Page view — deps are injectable (defaults to the live api clients) so
// specs can pass fakes instead of jest.mock-ing the axios layer.
// --------------------------------------------------------------------------

export interface ReportsViewProps {
  reports?: ReportsApi;
  listShops?: () => Promise<Shop[]>;
}

// Stable module-level defaults so the useEffect that loads shops does not
// re-fire on every render when the props are not injected.
async function defaultListShops(): Promise<Shop[]> {
  return adminApi.listShops();
}

export function ReportsView({
  reports = reportsApi,
  listShops = defaultListShops,
}: ReportsViewProps = {}) {
  const { user, isLoading } = useAuth();

  const initialRange = useMemo(() => defaultRange(), []);
  const [question, setQuestion] = useState('');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [shopId, setShopId] = useState('');
  const [groupBy, setGroupBy] = useState<SalesGroupBy>('day');
  const [limit, setLimit] = useState(String(DEFAULT_TOP_PRODUCTS_LIMIT));
  const [sortBy, setSortBy] = useState<TopProductsSortBy>('revenue');

  const [activeType, setActiveType] = useState<ReportType | null>(null);
  const [report, setReport] = useState<AnyReport | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [engine, setEngine] = useState<AskEngine | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsError, setShopsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listShops()
      .then(items => {
        if (!cancelled) setShops(items);
      })
      .catch(() => {
        // The shop filter degrades to "All shops only" if this fails.
        if (!cancelled) {
          setShops([]);
          setShopsError('Could not load shops; only the all-shops view is available.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [listShops]);

  const rangeParams = useCallback(
    () => ({ from: from.trim(), to: to.trim(), ...(shopId ? { shopId } : {}) }),
    [from, to, shopId],
  );

  const runReport = useCallback(
    async (type: ReportType) => {
      setActiveType(type);
      setInterpretation(null);
      setEngine(null);
      setError(null);
      setLoading(true);
      try {
        const range = rangeParams();
        let next: AnyReport;
        switch (type) {
          case 'sales-summary':
            next = await reports.salesSummary({ ...range, groupBy });
            break;
          case 'top-products':
            next = await reports.topProducts({ ...range, limit: parseLimit(limit), sortBy });
            break;
          case 'sales-by-category':
            next = await reports.salesByCategory(range);
            break;
          case 'payment-methods':
            next = await reports.paymentMethods(range);
            break;
          case 'inventory-valuation':
            // Date controls do not apply — send only the shop filter.
            next = await reports.inventoryValuation(shopId ? { shopId } : {});
            break;
        }
        setReport(next);
      } catch (err) {
        // client.ts normalises API failures into Error with a readable message.
        setError(err instanceof Error ? err.message : 'Failed to load the report. Please try again.');
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [reports, rangeParams, groupBy, limit, sortBy, shopId],
  );

  const handleAsk = useCallback(async () => {
    const trimmed = question.trim();
    if (trimmed === '') return;
    setError(null);
    setInterpretation(null);
    setEngine(null);
    setReport(null);
    setLoading(true);
    try {
      const result = await reports.ask({
        question: trimmed,
        ...(shopId ? { shopId } : {}),
      });
      setInterpretation(result.interpretation);
      setEngine(result.engine);
      setReport(result.report);
      setActiveType(result.report.reportType);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not understand the question. Please try a preset report instead.',
      );
    } finally {
      setLoading(false);
    }
  }, [question, reports, shopId]);

  if (isLoading || !user) {
    return <LoadingSpinner fullPage text="Loading reports..." />;
  }

  const questionTooLong = question.length > ASK_QUESTION_MAX_LENGTH;
  const showDateControls = !isDateless(activeType);

  return (
    <RoleGuard allowedRoles={['owner', 'manager']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Reports</h1>
        <p className={styles.subtitle}>
          Ask questions in plain English or run one of the preset reports over a date range and
          shop.
        </p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* Ask box */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Ask a question</h2>
          <form
            className={styles.askRow}
            onSubmit={e => {
              e.preventDefault();
              void handleAsk();
            }}
          >
            <input
              type="text"
              className={styles.askInput}
              value={question}
              maxLength={ASK_QUESTION_MAX_LENGTH}
              placeholder="Ask in plain English… e.g. 'top 5 products by quantity last week'"
              aria-label="Ask a question about your reports"
              onChange={e => setQuestion(e.target.value)}
            />
            <button
              type="submit"
              className={`${styles.button} ${styles.primary}`}
              disabled={question.trim() === '' || questionTooLong || loading}
            >
              Ask
            </button>
          </form>
          {questionTooLong && (
            <p className={styles.fieldHint}>Questions are limited to {ASK_QUESTION_MAX_LENGTH} characters.</p>
          )}
        </div>

        {/* Report controls */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Filters</h2>
          <div className={styles.controlsRow}>
            {showDateControls && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="report-from">
                    From
                  </label>
                  <input
                    id="report-from"
                    type="date"
                    value={from}
                    onChange={e => setFrom(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="report-to">
                    To
                  </label>
                  <input
                    id="report-to"
                    type="date"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="report-shop">
                Shop
              </label>
              <select
                id="report-shop"
                value={shopId}
                onChange={e => setShopId(e.target.value)}
              >
                <option value="">All shops</option>
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
            {activeType === 'sales-summary' && (
              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="report-group-by">
                  Group by
                </label>
                <select
                  id="report-group-by"
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value as SalesGroupBy)}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </select>
              </div>
            )}
            {activeType === 'top-products' && (
              <>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="report-limit">
                    Top
                  </label>
                  <input
                    id="report-limit"
                    type="number"
                    min={TOP_PRODUCTS_LIMIT_MIN}
                    max={TOP_PRODUCTS_LIMIT_MAX}
                    value={limit}
                    onChange={e => setLimit(e.target.value)}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="report-sort-by">
                    Sort by
                  </label>
                  <select
                    id="report-sort-by"
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as TopProductsSortBy)}
                  >
                    <option value="revenue">Revenue</option>
                    <option value="qty">Quantity</option>
                  </select>
                </div>
              </>
            )}
          </div>
          {shopsError && <p className={styles.fieldHint}>{shopsError}</p>}
          {isDateless(activeType) && (
            <p className={styles.fieldHint}>Inventory valuation is a snapshot — the date range does not apply.</p>
          )}
        </div>

        {/* Preset report cards */}
        <div className={styles.reportCards} role="group" aria-label="Preset reports">
          {PRESET_CARDS.map(card => (
            <button
              key={card.type}
              type="button"
              className={`${styles.reportCard} ${activeType === card.type ? styles.reportCardActive : ''}`}
              onClick={() => void runReport(card.type)}
              disabled={loading}
            >
              <span className={styles.reportCardLabel}>{card.label}</span>
              <span className={styles.reportCardDescription}>{card.description}</span>
            </button>
          ))}
        </div>

        {/* Interpretation banner + results */}
        {(interpretation || engine) && (
          <div className={styles.interpretationBanner}>
            {engine && <span className={styles.engineBadge}>{engine}</span>}
            {interpretation && <span>{interpretation}</span>}
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Results</h2>
          {loading ? (
            <div className={styles.center}>
              <LoadingSpinner text="Crunching numbers…" />
            </div>
          ) : report ? (
            <ReportResult report={report} />
          ) : (
            <p className={styles.empty}>
              Ask a question above or pick a report to see results.
            </p>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

export default function ReportsPage() {
  return <ReportsView />;
}
