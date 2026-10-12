'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { BarChart, type BarChartRow } from '@/components/reports/BarChart';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api/admin';
import { forecastApi, type ForecastApi } from '@/lib/api/forecast';
import type { Shop } from '@/types/admin';
import type { ForecastListResponse, ForecastProductDetail, ForecastRisk } from '@/types/forecast';
import { RISK_LABELS, formatDaysOfCover, formatQty1, formatQty3 } from '@/types/forecast';
import { formatCount } from '@/types/reports';
import styles from './page.module.css';

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_HORIZON_DAYS = 14;

const HORIZON_OPTIONS = [7, 14, 30, 60] as const;

/** The risk chip value '' means "All" and is never sent as a param. */
type RiskFilter = ForecastRisk | '';

const RISK_CHIPS: { value: RiskFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'out_of_stock', label: RISK_LABELS.out_of_stock },
  { value: 'low', label: RISK_LABELS.low },
  { value: 'ok', label: RISK_LABELS.ok },
  { value: 'overstock', label: RISK_LABELS.overstock },
];

/** 'YYYY-MM-DD' -> 'MM-DD' chart label. */
function shortDate(date: string): string {
  return date.length >= 10 ? date.slice(5, 10) : date;
}

function riskBadgeClass(risk: ForecastRisk): string {
  switch (risk) {
    case 'out_of_stock':
      return styles.badgeOutOfStock;
    case 'low':
      return styles.badgeLow;
    case 'ok':
      return styles.badgeOk;
    case 'overstock':
      return styles.badgeOverstock;
  }
}

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

// --------------------------------------------------------------------------
// Expanded row panel — 28-day demand history + forecast bars (BarChart is
// reused verbatim; a sibling LineChart was not needed) + summary fields.
// --------------------------------------------------------------------------

function ProductDetailPanel({ detail, horizonDays }: { detail: ForecastProductDetail; horizonDays: number }) {
  const historyRows: BarChartRow[] = detail.history.map(point => ({
    label: shortDate(point.date),
    value: point.qtySold,
  }));
  const forecastRows: BarChartRow[] = detail.forecastSeries.map(point => ({
    label: shortDate(point.date),
    value: point.expectedQty,
  }));

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailSummary}>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Unit</span>
          <span>{detail.unit}</span>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Avg daily qty</span>
          <span>{formatQty3(detail.avgDailyQty)}</span>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Forecast ({horizonDays}d)</span>
          <span>{formatQty1(detail.forecastQty)}</span>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Current stock</span>
          <span>{formatCount(detail.currentStock)}</span>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Days of cover</span>
          <span>{formatDaysOfCover(detail.daysOfCover)}</span>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Risk</span>
          <span className={`${styles.badge} ${riskBadgeClass(detail.risk)}`}>
            {RISK_LABELS[detail.risk]}
          </span>
        </div>
        <div className={styles.detailField}>
          <span className={styles.detailLabel}>Suggested order</span>
          <span>{formatCount(detail.suggestedOrderQty)}</span>
        </div>
      </div>

      <div className={styles.chartsRow}>
        <div className={styles.chartBlock}>
          <h3 className={styles.chartTitle}>28-day demand history</h3>
          {historyRows.length === 0 ? (
            <p className={styles.empty}>No sales history.</p>
          ) : (
            <BarChart
              rows={historyRows}
              formatter={formatQty1}
              ariaLabel={`Daily quantity sold over the last 28 days for ${detail.name}`}
            />
          )}
        </div>
        <div className={styles.chartBlock}>
          <h3 className={styles.chartTitle}>Next {horizonDays}-day forecast</h3>
          {forecastRows.length === 0 ? (
            <p className={styles.empty}>No forecast series.</p>
          ) : (
            <BarChart
              rows={forecastRows}
              formatter={formatQty1}
              ariaLabel={`Expected daily quantity over the next ${horizonDays} days for ${detail.name}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Page view — deps are injectable (defaults to the live api clients) so
// specs can pass fakes instead of jest.mock-ing the axios layer.
// --------------------------------------------------------------------------

export interface ForecastViewProps {
  forecast?: ForecastApi;
  listShops?: () => Promise<Shop[]>;
}

// Stable module-level defaults so the useEffect that loads shops does not
// re-fire on every render when the props are not injected.
async function defaultListShops(): Promise<Shop[]> {
  return adminApi.listShops();
}

export function ForecastView({
  forecast = forecastApi,
  listShops = defaultListShops,
}: ForecastViewProps = {}) {
  const { user, isLoading } = useAuth();

  const [horizonDays, setHorizonDays] = useState<number>(DEFAULT_HORIZON_DAYS);
  const [shopId, setShopId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [risk, setRisk] = useState<RiskFilter>('');
  const [reloadNonce, setReloadNonce] = useState(0);

  const [data, setData] = useState<ForecastListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsError, setShopsError] = useState<string | null>(null);

  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ForecastProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  // Debounce the search box before it becomes a query param.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    forecast
      .list({
        horizonDays,
        ...(shopId ? { shopId } : {}),
        ...(risk ? { risk } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      })
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch(err => {
        // client.ts normalises API failures into Error with a readable message.
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load the forecast.');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [forecast, horizonDays, shopId, risk, debouncedSearch, reloadNonce]);

  // Lazy per-product detail for the single expanded row; re-fetches when the
  // horizon changes while a row is open.
  useEffect(() => {
    if (expandedProductId === null) return;
    let cancelled = false;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    forecast
      .productDetail(expandedProductId, { horizonDays })
      .then(result => {
        if (!cancelled) setDetail(result);
      })
      .catch(err => {
        if (!cancelled) {
          setDetailError(
            err instanceof Error ? err.message : 'Could not load the product forecast.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [forecast, expandedProductId, horizonDays]);

  const toggleRow = useCallback((productId: string) => {
    // Collapsing clears the panel; opening a different row replaces it
    // (single row open at a time is guaranteed by the single id state).
    setExpandedProductId(current => (current === productId ? null : productId));
    setDetail(null);
    setDetailError(null);
  }, []);

  const handleRefresh = useCallback(() => {
    setExpandedProductId(null);
    setReloadNonce(nonce => nonce + 1);
  }, []);

  if (isLoading || !user) {
    return <LoadingSpinner fullPage text="Loading forecast..." />;
  }

  const rows = data?.rows ?? [];

  return (
    <RoleGuard allowedRoles={['owner', 'manager']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Stock Forecasting</h1>
        <p className={styles.subtitle}>
          Days-of-cover projections per product over the selected horizon, with suggested
          reorder quantities.
        </p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className={styles.card}>
          <div className={styles.controlsRow}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="forecast-horizon">
                Horizon
              </label>
              <select
                id="forecast-horizon"
                value={horizonDays}
                onChange={e => setHorizonDays(Number(e.target.value))}
              >
                {HORIZON_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {option} days
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="forecast-shop">
                Shop
              </label>
              <select id="forecast-shop" value={shopId} onChange={e => setShopId(e.target.value)}>
                <option value="">All shops</option>
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="forecast-search">
                Search
              </label>
              <input
                id="forecast-search"
                type="text"
                value={searchInput}
                placeholder="Product name or SKU…"
                aria-label="Search products"
                onChange={e => setSearchInput(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={`${styles.button} ${styles.primary}`}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
          {shopsError && <p className={styles.fieldHint}>{shopsError}</p>}

          <div className={styles.chipRow} role="group" aria-label="Risk filter">
            {RISK_CHIPS.map(chip => (
              <button
                key={chip.value || 'all'}
                type="button"
                className={`${styles.chip} ${risk === chip.value ? styles.chipActive : ''}`}
                aria-pressed={risk === chip.value}
                onClick={() => setRisk(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary strip */}
        {data && (
          <div className={styles.summaryStrip} aria-label="Forecast summary">
            <div className={styles.summaryItem}>
              <span className={styles.summaryValue}>{formatCount(data.totals.products)}</span>
              <span className={styles.summaryLabel}>Products</span>
            </div>
            <div className={`${styles.summaryItem} ${styles.summaryDanger}`}>
              <span className={styles.summaryValue}>{formatCount(data.totals.outOfStock)}</span>
              <span className={styles.summaryLabel}>Out of stock</span>
            </div>
            <div className={`${styles.summaryItem} ${styles.summaryWarn}`}>
              <span className={styles.summaryValue}>{formatCount(data.totals.low)}</span>
              <span className={styles.summaryLabel}>Low cover</span>
            </div>
            <span className={styles.generatedAt}>
              Generated at {formatGeneratedAt(data.generatedAt)}
            </span>
          </div>
        )}

        {/* Results table */}
        <div className={styles.card}>
          {loading ? (
            <div className={styles.center}>
              <LoadingSpinner text="Loading forecast…" />
            </div>
          ) : data ? (
            rows.length === 0 ? (
              <p className={styles.empty}>No products match this filter</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Unit</th>
                      <th>Avg daily qty</th>
                      <th>Forecast ({data.horizonDays}d)</th>
                      <th>Stock</th>
                      <th>Days of cover</th>
                      <th>Risk</th>
                      <th>Suggested order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <Fragment key={row.productId}>
                        <tr
                          className={styles.clickableRow}
                          aria-expanded={expandedProductId === row.productId}
                          onClick={() => toggleRow(row.productId)}
                        >
                          <td>
                            {row.name}
                            <span className={styles.rowSku}>{row.sku}</span>
                          </td>
                          <td>{row.unit}</td>
                          <td className={styles.cellNumber}>{formatQty3(row.avgDailyQty)}</td>
                          <td className={styles.cellNumber}>{formatQty1(row.forecastQty)}</td>
                          <td className={styles.cellNumber}>{formatCount(row.currentStock)}</td>
                          <td className={styles.cellNumber}>{formatDaysOfCover(row.daysOfCover)}</td>
                          <td>
                            <span className={`${styles.badge} ${riskBadgeClass(row.risk)}`}>
                              {RISK_LABELS[row.risk]}
                            </span>
                          </td>
                          <td className={styles.cellNumber}>
                            {row.suggestedOrderQty > 0 ? (
                              <strong>{formatCount(row.suggestedOrderQty)}</strong>
                            ) : (
                              formatCount(row.suggestedOrderQty)
                            )}
                          </td>
                        </tr>
                        {expandedProductId === row.productId && (
                          <tr className={styles.detailRow}>
                            <td colSpan={8}>
                              {detailLoading ? (
                                <LoadingSpinner text="Loading product forecast…" />
                              ) : detailError ? (
                                <div className={styles.errorBanner} role="alert">
                                  {detailError}
                                </div>
                              ) : detail ? (
                                <ProductDetailPanel detail={detail} horizonDays={horizonDays} />
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <p className={styles.empty}>Nothing to show yet.</p>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}

export default function ForecastPage() {
  return <ForecastView />;
}
