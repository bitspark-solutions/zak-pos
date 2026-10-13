'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { ROUTES } from '@/lib/utils/constants';
import { downloadPdf, posApi } from '@/lib/api/pos';
import { usePosCart } from './usePosCart';
import { BarcodeScanner } from './BarcodeScanner';
import styles from './page.module.css';
import {
  cartItemCount,
  computeChange,
  DISCOUNT_PRESETS_PERCENT,
  formatMoney,
  presetPercentForDiscount,
  shouldProcessScan,
} from '@/lib/pos/pos-helpers';
import type { CommitSaleResult, PaymentMethod, PosProductResult } from '@/types/pos';

// Same styling family as the (dashboard)/receipts and /import pages.

type Phase = 'sale' | 'paying' | 'done';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bkash', label: 'bKash' },
  { value: 'nagad', label: 'Nagad' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

const CUSTOM_DISCOUNT = '__custom';

// The discount column shows the % preset whose absolute amount the server
// holds for the line; -1 (custom amount, e.g. after a qty change re-priced
// the line) renders as an explicit read-only option so nothing is hidden.
function discountSelectValue(unitPrice: number, qty: number, discount: number): string {
  const percent = presetPercentForDiscount(unitPrice, qty, discount);
  return percent === -1 ? CUSTOM_DISCOUNT : String(percent);
}

interface ProductSearchProps {
  onSelect: (product: PosProductResult) => void;
  disabled: boolean;
}

/**
 * Debounced manual product search (GET /products?search=) with a tappable
 * result list — the standalone path when there is no barcode or no camera.
 * Same request-sequencing idiom as the receipts ProductPicker.
 */
function ProductSearch({ onSelect, disabled }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosProductResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const requestSeq = useRef(0);

  const runSearch = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (trimmed === '') {
      setResults([]);
      setOpen(false);
      return;
    }
    const seq = ++requestSeq.current;
    setSearching(true);
    try {
      const items = await posApi.searchProducts(trimmed);
      if (seq !== requestSeq.current) return;
      setResults(items);
      setOpen(true);
    } catch {
      if (seq !== requestSeq.current) return;
      setResults([]);
    } finally {
      if (seq === requestSeq.current) setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      void runSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  const pick = (product: PosProductResult) => {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className={styles.searchWrap}>
      <input
        type="text"
        value={query}
        placeholder="Search products by name or SKU…"
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void runSearch(query);
          }
        }}
        disabled={disabled}
        aria-label="Search products to add"
      />
      {searching && <span className={styles.pickerSearching}>Searching…</span>}
      {open && !searching && (
        <ul className={styles.searchResults}>
          {results.length === 0 ? (
            <li className={styles.pickerEmpty}>No matching products.</li>
          ) : (
            results.map(product => (
              <li key={product.id}>
                <button
                  type="button"
                  className={styles.searchItem}
                  onClick={() => pick(product)}
                  disabled={disabled}
                >
                  <span>{product.name}</span>
                  <span className={styles.searchItemMeta}>
                    {product.sku ? `${product.sku} · ` : ''}৳{formatMoney(product.basePrice)}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function POSPage() {
  const { user, isLoading } = useAuth();
  const {
    shop,
    shopLoading,
    cart,
    busy,
    error,
    clearError,
    lookupBarcode,
    addProduct,
    addFromSearch,
    incrementLine,
    decrementLine,
    setLineDiscountPercent,
    removeLine,
    resetCart,
  } = usePosCart();

  const [phase, setPhase] = useState<Phase>('sale');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [result, setResult] = useState<CommitSaleResult | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<'receipt' | 'invoice' | null>(null);

  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [cameraNotice, setCameraNotice] = useState<string | null>(null);

  // Scan cooldown: a camera sees the same code ~10 frames/second while the
  // item dwells in front of the lens; only one add per window may pass.
  const cooldownRef = useRef<{ lastCode: string | null; lastSeenAt: number }>({
    lastCode: null,
    lastSeenAt: 0,
  });

  const handleScannedCode = useCallback(
    async (code: string) => {
      if (code === '') return;
      const now = Date.now();
      const cooldown = cooldownRef.current;
      if (!shouldProcessScan(code, cooldown.lastCode, cooldown.lastSeenAt, now)) return;
      cooldownRef.current = { lastCode: code, lastSeenAt: now };

      clearError();
      const product = await lookupBarcode(code);
      if (!product) {
        setUnknownBarcode(code);
        setScanNotice(null);
        return;
      }
      setUnknownBarcode(null);
      const line = await addProduct(product.id, { barcode: code });
      if (line) {
        setScanNotice(`Added ${product.name}`);
      } else {
        setScanNotice(null);
      }
    },
    [lookupBarcode, addProduct, clearError],
  );

  const handleCameraUnavailable = useCallback((reason: string) => {
    setCameraNotice(reason);
  }, []);

  // Checkout errors share the banner with cart-mutation errors.
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // A failed commit leaves the cart tendered server-side (tender cannot be
  // undone); remember the token so a retry skips the tender step instead of
  // hitting "Cart already tendered".
  const tenderedTokenRef = useRef<string | null>(null);

  const tenderedNumber = tendered.trim() === '' ? NaN : Number(tendered);
  const cartTotal = cart?.total ?? 0;
  // Blank cash tender = exact amount (the server defaults amountTendered to
  // the cart total); any entered amount below the total is blocked client-side
  // because the server rejects underpayments.
  const cashShort =
    paymentMethod === 'cash' &&
    tendered.trim() !== '' &&
    !(Number.isFinite(tenderedNumber) && tenderedNumber >= cartTotal);
  const change =
    paymentMethod === 'cash' && Number.isFinite(tenderedNumber)
      ? computeChange(cartTotal, tenderedNumber)
      : 0;

  const handleCheckout = async () => {
    if (!cart || cart.lines.length === 0) return;
    clearBannerError();
    setPhase('paying');
    try {
      // CRITICAL server contract: /sales/commit rejects a cart whose status
      // is not 'tendered'. Tender first, then commit.
      if (cart.token !== tenderedTokenRef.current) {
        await posApi.tenderCart(cart.token);
        tenderedTokenRef.current = cart.token;
      }
      const committed = await posApi.commitSale({
        cartToken: cart.token,
        paymentMethod,
        ...(paymentMethod === 'cash' && tendered.trim() !== ''
          ? { amountTendered: tenderedNumber }
          : {}),
      });
      tenderedTokenRef.current = null;
      setResult(committed);
      setPhase('done');
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'The sale could not be committed.');
      setPhase('sale');
    }
  };

  const clearBannerError = () => {
    clearError();
    setCheckoutError(null);
  };

  const displayedError = error ?? checkoutError;

  const handleNewSale = async () => {
    setResult(null);
    setInvoiceId(null);
    setTendered('');
    setPaymentMethod('cash');
    setUnknownBarcode(null);
    setScanNotice(null);
    setCameraNotice(null);
    tenderedTokenRef.current = null;
    clearBannerError();
    await resetCart();
    setPhase('sale');
  };

  const handleDownloadReceipt = async () => {
    if (!result) return;
    setPdfBusy('receipt');
    clearBannerError();
    try {
      await downloadPdf(`/sales/${result.sale.id}/receipt`, `receipt-${result.sale.id}.pdf`);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not download the receipt.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleIssueInvoice = async () => {
    if (!result) return;
    setPdfBusy('invoice');
    clearBannerError();
    try {
      const invoice = await posApi.createInvoiceFromSale(result.sale.id);
      setInvoiceId(invoice.id);
      await downloadPdf(`/invoices/${invoice.id}/pdf`, `invoice-${invoice.id}.pdf`);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not issue the invoice.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!invoiceId) return;
    setPdfBusy('invoice');
    clearBannerError();
    try {
      await downloadPdf(`/invoices/${invoiceId}/pdf`, `invoice-${invoiceId}.pdf`);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not download the invoice.');
    } finally {
      setPdfBusy(null);
    }
  };

  if (isLoading || !user) {
    return <LoadingSpinner fullPage text="Loading POS..." />;
  }

  const items = cart ? cartItemCount(cart.lines) : 0;
  const lineCount = cart?.lines.length ?? 0;
  const checkoutDisabled = !cart || cart.lines.length === 0 || cashShort;

  return (
    <RoleGuard allowedRoles={['cashier', 'manager', 'owner']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Point of Sale</h1>

        {displayedError && (
          <div className={styles.errorBanner} role="alert">
            {displayedError}
          </div>
        )}


        {phase === 'done' && result ? (
          /* Sale-complete panel: totals + PDF receipt + invoice actions */
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Sale complete</h2>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Sale ID</span>
                <span className={styles.summaryValue}>{result.sale.id}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Subtotal</span>
                <span className={styles.summaryValue}>৳{formatMoney(result.sale.subtotal)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Discount</span>
                <span className={styles.summaryValue}>৳{formatMoney(result.sale.discount)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Tax</span>
                <span className={styles.summaryValue}>৳{formatMoney(result.sale.tax)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total</span>
                <span className={styles.summaryValue}>৳{formatMoney(result.sale.total)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Payment</span>
                <span className={styles.summaryValue}>{paymentMethod}</span>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={() => void handleDownloadReceipt()}
                disabled={pdfBusy !== null}
              >
                {pdfBusy === 'receipt' ? 'Downloading…' : 'Download receipt (PDF)'}
              </button>
              {invoiceId ? (
                <button
                  type="button"
                  className={`${styles.button} ${styles.secondary}`}
                  onClick={() => void handleDownloadInvoice()}
                  disabled={pdfBusy !== null}
                >
                  {pdfBusy === 'invoice' ? 'Downloading…' : 'Download invoice (PDF)'}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.button} ${styles.secondary}`}
                  onClick={() => void handleIssueInvoice()}
                  disabled={pdfBusy !== null}
                >
                  {pdfBusy === 'invoice' ? 'Issuing…' : 'Issue invoice (PDF)'}
                </button>
              )}
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={() => void handleNewSale()}
              >
                New sale
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top bar: shop + running totals */}
            <div className={styles.topBar}>
              <div className={styles.shopBlock}>
                <span className={styles.summaryLabel}>Shop</span>
                <span className={styles.shopName}>
                  {shopLoading ? 'Loading shop…' : shop ? shop.name : 'No shop configured'}
                </span>
              </div>
              <div className={styles.topStat}>
                <span className={styles.summaryLabel}>Items</span>
                <span className={styles.topStatValue}>{items}</span>
              </div>
              <div className={styles.topStat}>
                <span className={styles.summaryLabel}>Lines</span>
                <span className={styles.topStatValue}>{lineCount}</span>
              </div>
              <div className={styles.topStat}>
                <span className={styles.summaryLabel}>Total (BDT)</span>
                <span className={styles.topStatTotal}>৳{formatMoney(cart?.total ?? 0)}</span>
              </div>
            </div>

            <div className={styles.layout}>
              <div className={styles.leftColumn}>
                {/* Scan panel */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Scan</h2>
                  <BarcodeScanner
                    onScan={code => void handleScannedCode(code)}
                    onUnavailable={handleCameraUnavailable}
                    disabled={phase === 'paying'}
                  />
                  {cameraNotice && (
                    <p className={styles.notice} role="status">
                      {cameraNotice}
                    </p>
                  )}
                  {scanNotice && (
                    <p className={styles.scanNotice} role="status">
                      {scanNotice}
                    </p>
                  )}
                  {unknownBarcode && (
                    <div className={styles.unknownItem} role="alert">
                      Unknown item <strong>{unknownBarcode}</strong> — this barcode is not in the
                      catalog.{' '}
                      <Link href={ROUTES.IMPORT} className={styles.unknownItemLink}>
                        Add it via Catalog import
                      </Link>
                      .
                    </div>
                  )}
                </div>

                {/* Manual add */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Add manually</h2>
                  <ProductSearch
                    onSelect={product => {
                      setUnknownBarcode(null);
                      void addFromSearch(product);
                    }}
                    disabled={busy || phase === 'paying'}
                  />
                  <p className={styles.hint}>
                    For items without a barcode, or when the counter has no camera.
                  </p>
                </div>

                {/* Checkout */}
                <div className={styles.card}>
                  <h2 className={styles.cardTitle}>Payment</h2>
                  <div className={styles.segmented} role="group" aria-label="Payment method">
                    {PAYMENT_METHODS.map(method => (
                      <button
                        key={method.value}
                        type="button"
                        className={`${styles.segmentButton} ${
                          paymentMethod === method.value ? styles.segmentButtonActive : ''
                        }`}
                        aria-pressed={paymentMethod === method.value}
                        onClick={() => setPaymentMethod(method.value)}
                        disabled={busy || phase === 'paying'}
                      >
                        {method.label}
                      </button>
                    ))}
                  </div>

                  {paymentMethod === 'cash' && (
                    <div className={styles.field}>
                      <label className={styles.fieldLabel} htmlFor="pos-tendered">
                        Amount tendered (৳)
                      </label>
                      <input
                        id="pos-tendered"
                        type="text"
                        inputMode="decimal"
                        value={tendered}
                        placeholder={formatMoney(cartTotal)}
                        onChange={e => setTendered(e.target.value)}
                        disabled={busy || phase === 'paying'}
                      />
                      {Number.isFinite(tenderedNumber) && tenderedNumber < cartTotal && (
                        <span className={styles.fieldError}>
                          Short by ৳{formatMoney(cartTotal - tenderedNumber)} — the server rejects
                          underpayments.
                        </span>
                      )}
                      <span className={styles.hint}>Change due: ৳{formatMoney(change)}</span>
                    </div>
                  )}

                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Subtotal</span>
                      <span className={styles.summaryValue}>৳{formatMoney(cart?.subtotal ?? 0)}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Discount</span>
                      <span className={styles.summaryValue}>৳{formatMoney(cart?.discount ?? 0)}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Tax</span>
                      <span className={styles.summaryValue}>৳{formatMoney(cart?.tax ?? 0)}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Total</span>
                      <span className={styles.summaryValue}>৳{formatMoney(cartTotal)}</span>
                    </div>
                  </div>

                  <div className={styles.actions}>
                    {cart && cart.lines.length > 0 && (
                      <button
                        type="button"
                        className={`${styles.button} ${styles.secondary}`}
                        onClick={() => void handleNewSale()}
                        disabled={phase === 'paying'}
                      >
                        Clear sale
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${styles.button} ${styles.primary}`}
                      onClick={() => void handleCheckout()}
                      disabled={checkoutDisabled || phase === 'paying'}
                    >
                      {phase === 'paying' ? 'Taking payment…' : `Take payment (৳${formatMoney(cartTotal)})`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Cart table */}
              <div className={styles.card}>
                <div className={styles.header}>
                  <h2 className={styles.cardTitle}>Cart</h2>
                  {items > 0 && (
                    <span className={styles.selectionBadge}>
                      {items} {items === 1 ? 'item' : 'items'} · ৳{formatMoney(cartTotal)}
                    </span>
                  )}
                </div>

                {!cart || cart.lines.length === 0 ? (
                  <p className={styles.empty}>Scan or search an item to start the sale.</p>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Qty</th>
                          <th>Unit price</th>
                          <th>Discount</th>
                          <th>Line total</th>
                          <th className={styles.cellAction}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.lines.map(line => {
                          const discountValue = discountSelectValue(line.unitPrice, line.qty, line.discount);
                          return (
                            <tr key={line.id}>
                              <td className={styles.cellItemName}>
                                {line.productName}
                                <span className={styles.cellSku}>{line.sku}</span>
                              </td>
                              <td>
                                <div className={styles.stepper}>
                                  <button
                                    type="button"
                                    className={styles.stepButton}
                                    onClick={() => void decrementLine(line.id, line.qty)}
                                    disabled={busy || phase === 'paying'}
                                    aria-label={`Decrease ${line.productName}`}
                                  >
                                    −
                                  </button>
                                  <span className={styles.stepperValue}>{line.qty}</span>
                                  <button
                                    type="button"
                                    className={styles.stepButton}
                                    onClick={() => void incrementLine(line.id)}
                                    disabled={busy || phase === 'paying'}
                                    aria-label={`Increase ${line.productName}`}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td>৳{formatMoney(line.unitPrice)}</td>
                              <td>
                                <select
                                  value={discountValue}
                                  onChange={e => {
                                    if (e.target.value !== CUSTOM_DISCOUNT) {
                                      void setLineDiscountPercent(line, Number(e.target.value));
                                    }
                                  }}
                                  disabled={busy || phase === 'paying'}
                                  aria-label={`Discount for ${line.productName}`}
                                >
                                  {DISCOUNT_PRESETS_PERCENT.map(percent => (
                                    <option key={percent} value={percent}>
                                      {percent}%
                                    </option>
                                  ))}
                                  {discountValue === CUSTOM_DISCOUNT && (
                                    <option value={CUSTOM_DISCOUNT}>
                                      custom ৳{formatMoney(line.discount)}
                                    </option>
                                  )}
                                </select>
                              </td>
                              <td>৳{formatMoney(line.lineTotal)}</td>
                              <td className={styles.cellAction}>
                                <button
                                  type="button"
                                  className={styles.removeButton}
                                  onClick={() => void removeLine(line.id)}
                                  disabled={busy || phase === 'paying'}
                                  aria-label={`Remove ${line.productName}`}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className={styles.hint}>
                  Rescanning the same barcode adds one more — the server merges duplicate lines.
                  Discounts are stored as absolute amounts like the mobile POS.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </RoleGuard>
  );
}
