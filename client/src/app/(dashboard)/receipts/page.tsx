'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoleGuard } from '@/components/guards/RoleGuard';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner';
import { receiptsApi, searchProducts, type ProductSearchResult } from '@/lib/api/receipts';
import type {
  ReceiptCommitLine,
  ReceiptCommitResult,
  ReceiptDraft,
  ReceiptLine,
  SupplierOption,
} from '@/types/receipts';
import styles from './page.module.css';

// Matches the multipart field constraints on POST /receipts/digitize.
const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.webp'];
const FILE_INPUT_ACCEPT = ACCEPTED_EXTENSIONS.join(',');

type Phase = 'upload' | 'digitizing' | 'review' | 'committing' | 'results';

type SupplierMode = 'pick' | 'create';

/** Receipt line row with string-backed editable fields (raw input values). */
interface EditableLineRow {
  lineId: number;
  name: string;
  matchedProductId: string | null;
  matchedProductName: string | null;
  qty: string;
  unitCost: string;
}

function toEditableRow(line: ReceiptLine): EditableLineRow {
  return {
    lineId: line.lineId,
    name: line.name,
    matchedProductId: line.matchedProductId,
    matchedProductName: line.matchedProductName,
    qty: line.qty == null ? '' : String(line.qty),
    unitCost: line.unitPrice == null ? '' : String(line.unitPrice),
  };
}

function fileKey(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/** Normalise a free-form OCR date to the yyyy-mm-dd value an <input type=date> needs. */
function toDateInputValue(value: string | null): string {
  if (!value) return '';
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value);
  if (match) return match[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

/** Merge supplier suggestions with the full supplier list, deduped by id and name. */
function dedupeSuppliers(suggestions: SupplierOption[], all: SupplierOption[]): SupplierOption[] {
  const byId = new Map<string, SupplierOption>();
  const seenNames = new Set<string>();
  for (const option of [...suggestions, ...all]) {
    const nameKey = option.name.trim().toLowerCase();
    if (!option.id || !nameKey) continue;
    if (byId.has(option.id) || seenNames.has(nameKey)) continue;
    byId.set(option.id, option);
    seenNames.add(nameKey);
  }
  return Array.from(byId.values());
}

function formatLineTotal(qtyText: string, costText: string): string {
  const qty = Number(qtyText);
  const unitCost = Number(costText);
  if (qtyText.trim() === '' || costText.trim() === '') return '—';
  if (!Number.isFinite(qty) || !Number.isFinite(unitCost)) return '—';
  return (qty * unitCost).toFixed(2);
}

function formatMoney(value: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toFixed(2);
}

interface ProductPickerProps {
  lineId: number;
  lineName: string;
  selectedId: string | null;
  selectedName: string | null;
  onSelect: (lineId: number, product: ProductSearchResult) => void;
  onClear: (lineId: number) => void;
}

/**
 * Searchable product matcher for one receipt line. Typing debounces into the
 * existing products search API (GET /products?search=); Enter searches
 * immediately. Up to 8 results are listed for one-click selection.
 */
function ProductPicker({ lineId, lineName, selectedId, selectedName, onSelect, onClear }: ProductPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  // Monotonic counter so a late response from an older keystroke never
  // overwrites fresher results.
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
      const items = await searchProducts(trimmed);
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

  if (selectedId && selectedName) {
    return (
      <div className={styles.pickerSelected}>
        <span className={styles.matchedChip}>{selectedName}</span>
        <button
          type="button"
          className={styles.removeFileButton}
          onClick={() => onClear(lineId)}
          aria-label={`Clear product match for ${lineName}`}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className={styles.picker}>
      <input
        type="text"
        value={query}
        placeholder="Search products…"
        onChange={e => setQuery(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void runSearch(query);
          }
        }}
        aria-label={`Search a product for ${lineName}`}
      />
      {searching && <span className={styles.pickerSearching}>Searching…</span>}
      {open && !searching && (
        <ul className={styles.pickerResults}>
          {results.length === 0 ? (
            <li className={styles.pickerEmpty}>No matching products.</li>
          ) : (
            results.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.pickerItem}
                  onClick={() => {
                    onSelect(lineId, item);
                    setQuery('');
                    setResults([]);
                    setOpen(false);
                  }}
                >
                  <span>{item.name}</span>
                  {item.sku && <span className={styles.pickerItemSku}>{item.sku}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  const { user, isLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ReceiptDraft | null>(null);
  const [rows, setRows] = useState<EditableLineRow[]>([]);
  const [result, setResult] = useState<ReceiptCommitResult | null>(null);

  const [supplierMode, setSupplierMode] = useState<SupplierMode>('pick');
  const [supplierId, setSupplierId] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [receive, setReceive] = useState(false);
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  // Suppliers are fetched once per draft when review starts; the picker list
  // is suggestions-first and deduped against the full supplier list.
  const [suppliersLoadedFor, setSuppliersLoadedFor] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== 'review' || !draft || suppliersLoadedFor === draft.draftId) return;
    setSuppliersLoadedFor(draft.draftId);
    receiptsApi
      .listSuppliers()
      .then(all => setSuppliers(dedupeSuppliers(draft.supplierSuggestions, all)))
      .catch(() => {
        // Suggestions from the draft remain usable if the full list fails.
      });
  }, [phase, draft, suppliersLoadedFor]);

  const handleFiles = (incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    if (list.length > 0) setFile(list[list.length - 1]);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const handleDigitize = async () => {
    if (!file) return;
    setPhase('digitizing');
    setError(null);
    try {
      const nextDraft = await receiptsApi.digitizeReceipt(file);
      setDraft(nextDraft);
      setRows(nextDraft.lines.map(toEditableRow));
      setSuppliers(dedupeSuppliers(nextDraft.supplierSuggestions, []));
      setDate(toDateInputValue(nextDraft.documentDate));
      setSupplierMode('pick');
      setSupplierId('');
      setNewSupplierName(nextDraft.vendor ?? '');
      setNotes('');
      setReceive(false);
      setDiscount(nextDraft.discount == null ? '' : String(nextDraft.discount));
      setTax(nextDraft.tax == null ? '' : String(nextDraft.tax));
      setPhase('review');
    } catch (err) {
      // client.ts normalises network/API failures into Error with a readable
      // message (e.g. "Network error. Please check your connection...").
      setError(err instanceof Error ? err.message : 'Digitization failed. Please try again.');
      setPhase('upload');
    }
  };

  const updateRow = (lineId: number, field: 'qty' | 'unitCost', value: string) => {
    setRows(prev => prev.map(row => (row.lineId === lineId ? { ...row, [field]: value } : row)));
  };

  const selectProduct = (lineId: number, product: ProductSearchResult) => {
    setRows(prev =>
      prev.map(row =>
        row.lineId === lineId
          ? { ...row, matchedProductId: product.id, matchedProductName: product.name }
          : row,
      ),
    );
  };

  const clearProduct = (lineId: number) => {
    setRows(prev =>
      prev.map(row =>
        row.lineId === lineId
          ? { ...row, matchedProductId: null, matchedProductName: null }
          : row,
      ),
    );
  };

  const removeRow = (lineId: number) => {
    setRows(prev => prev.filter(row => row.lineId !== lineId));
  };

  const matchedCount = rows.filter(row => row.matchedProductId !== null).length;

  const handleCommit = async () => {
    if (!draft) return;

    if (supplierMode === 'pick' && supplierId === '') {
      setError('Choose a supplier, or switch to "Create new" and enter a name.');
      return;
    }
    if (supplierMode === 'create' && newSupplierName.trim() === '') {
      setError('Enter a name for the new supplier.');
      return;
    }

    // Mirror the import page's client-side pre-commit validation. Lines that
    // are neither matched nor selected are silently excluded; matched lines
    // with bad numbers block the commit with an inline error.
    const validLines: ReceiptCommitLine[] = [];
    for (const row of rows) {
      if (!row.matchedProductId) continue;
      const qty = Number(row.qty);
      if (row.qty.trim() === '' || !Number.isFinite(qty) || qty <= 0) {
        setError(`"${row.name}" needs a quantity greater than 0.`);
        return;
      }
      const unitCost = Number(row.unitCost);
      if (row.unitCost.trim() === '' || !Number.isFinite(unitCost) || unitCost < 0) {
        setError(`"${row.name}" needs a unit cost of 0 or more.`);
        return;
      }
      validLines.push({ lineId: row.lineId, productId: row.matchedProductId, qty, unitCost });
    }
    if (validLines.length === 0) {
      setError('Match at least one receipt line to a product before saving the purchase.');
      return;
    }

    const discountValue = discount.trim() === '' ? null : Number(discount);
    if (discountValue !== null && (!Number.isFinite(discountValue) || discountValue < 0)) {
      setError('Discount must be a number of 0 or more, or left blank.');
      return;
    }
    const taxValue = tax.trim() === '' ? null : Number(tax);
    if (taxValue !== null && (!Number.isFinite(taxValue) || taxValue < 0)) {
      setError('Tax must be a number of 0 or more, or left blank.');
      return;
    }

    setError(null);
    setPhase('committing');
    try {
      const payload = {
        draftId: draft.draftId,
        lines: validLines,
        receive,
        ...(supplierMode === 'pick' ? { supplierId } : { newSupplierName: newSupplierName.trim() }),
        ...(date.trim() !== '' ? { date: date.trim() } : {}),
        ...(notes.trim() !== '' ? { notes: notes.trim() } : {}),
        ...(discountValue !== null ? { discount: discountValue } : {}),
        ...(taxValue !== null ? { tax: taxValue } : {}),
      };
      const res = await receiptsApi.commitReceipt(payload);
      setResult(res);
      setPhase('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving the purchase failed. Please try again.');
      setPhase('review');
    }
  };

  const startOver = () => {
    setPhase('upload');
    setFile(null);
    setDraft(null);
    setRows([]);
    setResult(null);
    setSuppliers([]);
    setSuppliersLoadedFor(null);
    setSupplierMode('pick');
    setSupplierId('');
    setNewSupplierName('');
    setDate('');
    setNotes('');
    setReceive(false);
    setDiscount('');
    setTax('');
    setError(null);
  };

  if (isLoading || !user) {
    return <LoadingSpinner fullPage text="Loading receipts..." />;
  }

  const busy = phase === 'digitizing' || phase === 'committing';

  return (
    <RoleGuard allowedRoles={['owner', 'manager']}>
      <div className={styles.container}>
        <h1 className={styles.title}>Receipts</h1>
        <p className={styles.subtitle}>
          Digitize supplier purchase receipts ({ACCEPTED_EXTENSIONS.join(', ')}) into purchases:
          OCR extracts the lines, you match them to products and save.
        </p>

        {error && (
          <div className={styles.errorBanner} role="alert">
            {error}
          </div>
        )}

        {/* Step 1 — upload the receipt */}
        {(phase === 'upload' || phase === 'digitizing') && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>1. Upload receipt</h2>

            <div
              className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
              }}
              onDragOver={e => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
            >
              Drag &amp; drop the receipt here, or click to browse
              <span className={styles.dropzoneHint}>
                Accepted: {ACCEPTED_EXTENSIONS.join(', ')} — one file per receipt
              </span>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept={FILE_INPUT_ACCEPT}
              hidden
              onChange={e => {
                if (e.target.files?.length) handleFiles(e.target.files);
                // Allow re-selecting the same file later.
                e.target.value = '';
              }}
            />

            {file && (
              <ul className={styles.fileList}>
                <li key={fileKey(file)} className={styles.fileListItem}>
                  <span>{file.name}</span>
                  <button
                    type="button"
                    className={styles.removeFileButton}
                    onClick={() => setFile(null)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ✕
                  </button>
                </li>
              </ul>
            )}

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={handleDigitize}
                disabled={!file || busy}
              >
                {phase === 'digitizing' ? 'Digitizing…' : 'Digitize'}
              </button>
            </div>

            {phase === 'digitizing' && (
              <p className={styles.center}>
                Reading the receipt — OCR runs server-side and may take a while.
              </p>
            )}
          </div>
        )}

        {/* Step 2 — review the draft */}
        {(phase === 'review' || phase === 'committing') && draft && (
          <div className={styles.card}>
            <div className={styles.header}>
              <h2 className={styles.cardTitle}>2. Review receipt</h2>
              <span className={styles.selectionBadge}>
                {matchedCount} of {rows.length} lines matched
              </span>
            </div>

            <div className={styles.summaryGrid}>
              <span className={styles.badge}>{draft.engine}</span>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Vendor (OCR)</span>
                <span className={styles.summaryValue}>{draft.vendor ?? '—'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Document date</span>
                <span className={styles.summaryValue}>{draft.documentDate ?? '—'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Currency</span>
                <span className={styles.summaryValue}>{draft.currency ?? '—'}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Subtotal</span>
                <span className={styles.summaryValue}>{formatMoney(draft.subtotal)}</span>
              </div>
              <div className={styles.summaryItem}>
                <span className={styles.summaryLabel}>Total</span>
                <span className={styles.summaryValue}>{formatMoney(draft.total)}</span>
              </div>
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Supplier</span>
                <div className={styles.segmented} role="group" aria-label="Supplier mode">
                  <button
                    type="button"
                    className={`${styles.segmentButton} ${supplierMode === 'pick' ? styles.segmentButtonActive : ''}`}
                    aria-pressed={supplierMode === 'pick'}
                    onClick={() => setSupplierMode('pick')}
                  >
                    Pick existing
                  </button>
                  <button
                    type="button"
                    className={`${styles.segmentButton} ${supplierMode === 'create' ? styles.segmentButtonActive : ''}`}
                    aria-pressed={supplierMode === 'create'}
                    onClick={() => setSupplierMode('create')}
                  >
                    Create new
                  </button>
                </div>
                {supplierMode === 'pick' ? (
                  <select
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                    aria-label="Choose supplier"
                  >
                    <option value="">Select a supplier…</option>
                    {suppliers.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newSupplierName}
                    placeholder="New supplier name"
                    onChange={e => setNewSupplierName(e.target.value)}
                    aria-label="New supplier name"
                  />
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="receipt-date">
                  Purchase date
                </label>
                <input
                  id="receipt-date"
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel} htmlFor="receipt-notes">
                  Notes
                </label>
                <textarea
                  id="receipt-notes"
                  value={notes}
                  placeholder="Optional notes about this purchase…"
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Amounts (blank = omit)</span>
                <div className={styles.amountRow}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discount}
                    placeholder="Discount"
                    aria-label="Discount amount"
                    onChange={e => setDiscount(e.target.value)}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={tax}
                    placeholder="Tax"
                    aria-label="Tax amount"
                    onChange={e => setTax(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.fieldLabel}>Stock</span>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={receive}
                    onChange={e => setReceive(e.target.checked)}
                  />
                  Mark as received and add to stock
                </label>
              </div>
            </div>

            {rows.length === 0 ? (
              <p className={styles.empty}>No line items were found on this receipt.</p>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Unit cost</th>
                      <th>Line total</th>
                      <th className={styles.cellAction}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.lineId} className={row.matchedProductId ? undefined : styles.rowUnmatched}>
                        <td className={styles.cellItemName}>{row.name}</td>
                        <td className={styles.cellMatch}>
                          <ProductPicker
                            lineId={row.lineId}
                            lineName={row.name}
                            selectedId={row.matchedProductId}
                            selectedName={row.matchedProductName}
                            onSelect={selectProduct}
                            onClear={clearProduct}
                          />
                        </td>
                        <td className={styles.cellInput}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.qty}
                            placeholder="0"
                            onChange={e => updateRow(row.lineId, 'qty', e.target.value)}
                            aria-label={`Quantity for ${row.name}`}
                          />
                        </td>
                        <td className={styles.cellInput}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={row.unitCost}
                            placeholder="0.00"
                            onChange={e => updateRow(row.lineId, 'unitCost', e.target.value)}
                            aria-label={`Unit cost for ${row.name}`}
                          />
                        </td>
                        <td className={styles.cellTotal}>
                          {formatLineTotal(row.qty, row.unitCost)}
                        </td>
                        <td className={styles.cellAction}>
                          <button
                            type="button"
                            className={styles.removeFileButton}
                            onClick={() => removeRow(row.lineId)}
                            aria-label={`Remove line ${row.name}`}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className={styles.notice}>
              Lines without a product match are excluded from the purchase.
            </p>

            <div className={styles.actions}>
              <button
                type="button"
                className={`${styles.button} ${styles.secondary}`}
                onClick={startOver}
                disabled={busy}
              >
                Start over
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.primary}`}
                onClick={handleCommit}
                disabled={matchedCount === 0 || busy}
              >
                {phase === 'committing'
                  ? 'Saving…'
                  : `Save purchase (${matchedCount} ${matchedCount === 1 ? 'line' : 'lines'})`}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — results */}
        {phase === 'results' && result && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>3. Purchase created</h2>

            <div className={styles.resultCounts}>
              <div className={`${styles.countCard} ${styles.countCreated}`}>
                <div className={styles.countValue}>{result.linesCreated}</div>
                <div className={styles.countLabel}>Lines created</div>
              </div>
              <div className={styles.countCard}>
                <div className={styles.countValue}>{formatMoney(result.total)}</div>
                <div className={styles.countLabel}>Total</div>
              </div>
              <div className={styles.countCard}>
                <div className={styles.countValue}>{result.status}</div>
                <div className={styles.countLabel}>Status</div>
              </div>
            </div>

            <div className={styles.resultSection}>
              <h3 className={styles.resultSectionTitle}>Purchase</h3>
              <ul className={styles.resultList}>
                <li className={styles.resultListItem}>
                  <span className={styles.muted}>Purchase ID</span>
                  <span className={styles.resultValue}>{result.purchaseId}</span>
                </li>
              </ul>
            </div>

            <div className={styles.actions}>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={startOver}>
                Digitize another
              </button>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
