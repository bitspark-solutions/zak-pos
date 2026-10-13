/**
 * Pure helpers for the scan-to-add-product flow (G1c).
 * No React Native imports — safe for jest (testEnvironment: node).
 * Unit-tested in product-helpers.spec.ts.
 *
 * Server contract notes (verified against server/src):
 *  - POST /products (product.dto.ts) REQUIRES `sku` as a string and has NO
 *    barcode field, and the global ValidationPipe uses forbidNonWhitelisted —
 *    so the scanned barcode cannot ride along on that route.
 *  - The only server path that creates Product + Barcode rows together (and
 *    auto-generates the SKU when blank) is POST /product-import/preview
 *    (multipart CSV) + POST /product-import/commit. The CSV header aliases
 *    (product-import.parsing.ts) we rely on: Name, Barcode, Sku, Price, Cost,
 *    Unit, Category. Barcode values are filtered to pure digits; a non-digit
 *    scanned code is therefore written to the Sku column instead.
 *  - Commit resolves `Category` by NAME (case-insensitive), so the CSV carries
 *    the category name from THIS tenant's GET /categories list (ids from the
 *    picker are mapped back to names before building the CSV).
 *  - Import does not cover `isWeighted`; after commit we PUT /products/:id
 *    with { isWeighted: true } when the toggle is on (server returns the full
 *    product, which we reuse for the cart add).
 *  - Opening stock: POST /inventory/adjust { type: 'IN' } creates the
 *    inventory row with avgCost = unitCost when absent (Phase D semantics).
 */
import type { AdjustStockPayload } from '@/lib/api/types';

/** Common units offered as tap chips (no typing). */
export const PRODUCT_UNITS = ['pcs', 'kg', 'ltr', 'box', 'pack', 'dozen'] as const;

/** Mirror of the form state the add-product screen edits (all inputs are display strings). */
export interface AddProductForm {
  barcode: string;
  name: string;
  basePrice: string;
  defaultCost: string;
  unit: string;
  /** free-text unit when the "Other" chip is active; '' otherwise */
  otherUnit: string;
  isWeighted: boolean;
  /** category NAME for the CSV (resolved from the picker); null = uncategorised */
  categoryName: string | null;
  stockQty: string;
  stockCost: string;
}

/** Parse a money/qty display string; '' or garbage -> null, otherwise rounded to 2 decimals. */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** The server's barcode parser keeps pure-digit values only (parseBarcodeList). */
export function isScannableBarcode(code: string): boolean {
  return /^\d+$/.test(code.trim());
}

export type AddProductField = 'name' | 'basePrice';

/** Inline validation: friendly message per field; empty object = form is saveable. */
export function validateAddProductForm(form: Pick<AddProductForm, 'name' | 'basePrice'>): Partial<Record<AddProductField, string>> {
  const errors: Partial<Record<AddProductField, string>> = {};
  if (form.name.trim() === '') {
    errors.name = 'Give the product a name.';
  }
  const price = parseAmountInput(form.basePrice);
  if (price === null) {
    errors.basePrice = 'Enter a valid selling price (0 or more).';
  }
  return errors;
}

/** Effective unit: the "Other" free text wins when set, else the chip value, else pcs. */
export function resolveUnit(form: Pick<AddProductForm, 'unit' | 'otherUnit'>): string {
  if (form.unit === 'other') {
    const other = form.otherUnit.trim();
    return other === '' ? 'pcs' : other;
  }
  return form.unit.trim() || 'pcs';
}

/** CSV cell escaping: always quote, double up embedded quotes, strip newlines. */
export function csvCell(value: string): string {
  const flat = value.replace(/[\r\n]+/g, ' ').trim();
  return `"${flat.replace(/"/g, '""')}"`;
}

/**
 * Build the single-row CSV uploaded to POST /product-import/preview.
 * SKU is left blank on digit barcodes so the server auto-generates it; a
 * non-digit scanned code goes into the Sku column instead (the Barcode
 * column would silently drop it).
 */
export function buildProductImportCsv(form: AddProductForm): string {
  const code = form.barcode.trim();
  const digitCode = isScannableBarcode(code) ? code : '';
  const skuFallback = code !== '' && digitCode === '' ? code : '';
  const price = parseAmountInput(form.basePrice);
  const cost = parseAmountInput(form.defaultCost);
  const rows = [
    ['Name', 'Barcode', 'Sku', 'Price', 'Cost', 'Unit', 'Category'],
    [
      form.name,
      digitCode,
      skuFallback,
      price !== null ? String(price) : '',
      cost !== null ? String(cost) : '',
      resolveUnit(form),
      form.categoryName ?? '',
    ],
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

/**
 * Opening-stock payload for POST /inventory/adjust, or null when nothing to add.
 * The IN movement with unitCost creates the inventory row with avgCost = unitCost.
 * Blank stockCost falls back to the product's defaultCost.
 */
export function buildOpeningStockPayload(
  shopId: string | null | undefined,
  productId: string,
  form: Pick<AddProductForm, 'stockQty' | 'stockCost' | 'defaultCost'>
): AdjustStockPayload | null {
  const qty = parseAmountInput(form.stockQty);
  if (!shopId || qty === null || qty <= 0) return null;
  const cost = parseAmountInput(form.stockCost) ?? parseAmountInput(form.defaultCost) ?? 0;
  return {
    shopId,
    productId,
    quantity: qty,
    type: 'IN',
    unitCost: cost,
    notes: 'Opening stock (mobile add product)',
  };
}

/** OWNER/MANAGER gate for product creation (server: Roles OWNER|MANAGER + product:create). */
export function canCreateProduct(user: { role?: string; permissions?: string[] } | null): boolean {
  if (!user) return false;
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes('product:create');
  }
  const role = (user.role ?? '').toLowerCase();
  return role === 'owner' || role === 'manager';
}
