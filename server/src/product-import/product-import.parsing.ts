import type {
  OcrExtractedProduct,
  ProductImportCandidate,
} from './interfaces/product-import.interface';

/**
 * Header aliases (all compared after lower-casing and stripping spaces) so
 * `Sale Price`, `basePrice`, `SALEPRICE` all map onto the `price` field.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ['name', 'title', 'product', 'productname', 'item'],
  sku: ['sku', 'code', 'productcode', 'itemcode', 'skucode'],
  price: ['price', 'baseprice', 'rate', 'saleprice', 'sellingprice'],
  cost: ['cost', 'costprice', 'purchaseprice', 'buyprice'],
  unit: ['unit', 'uom', 'units'],
  category: ['category', 'categoryname'],
  barcodes: ['barcode', 'barcodes'],
};

/** Normalised header key: lower-cased, non-alphanumerics collapsed to spaces. */
function normalizeHeaderWords(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((token) => token !== '');
}

/**
 * Map a header cell to a canonical field name (or null if unknown).
 *
 * Matching is case/space-insensitive and runs in two stages:
 *  1. exact match on the whitespace-free header (`saleprice`, `purchaseprice`,
 *     `categoryname`, ...);
 *  2. token match, preferring the field whose alias appears right-most — so
 *     `Product Code` -> sku while `Product Title` -> name.
 */
export function matchHeaderField(rawHeader: string): string | null {
  const nospace = normalizeHeaderWords(rawHeader).join('');
  if (nospace === '') {
    return null;
  }
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(nospace)) {
      return field;
    }
  }

  const tokens = normalizeHeaderWords(rawHeader);
  let bestField: string | null = null;
  let bestIndex = -1;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      // Only single-word aliases participate in the token pass.
      if (alias.length < 3 || alias.includes(' ')) {
        continue;
      }
      const index = tokens.lastIndexOf(alias);
      if (index > bestIndex) {
        bestIndex = index;
        bestField = field;
      }
    }
  }
  return bestField;
}

/** Raw, string-valued row keyed by canonical field names. */
export type RawSheetRow = Partial<Record<string, string>>;

/**
 * Turn a 2D sheet grid (first row = headers) into raw rows keyed by canonical
 * field names. Duplicate/unknown headers are ignored.
 */
export function mapSheetRows(grid: string[][]): RawSheetRow[] {
  if (grid.length === 0) {
    return [];
  }

  const headerRow = grid[0] ?? [];
  // columnIndex -> canonical field (or null).
  const fieldByColumn: (string | null)[] = headerRow.map((header) =>
    matchHeaderField(header ?? ''),
  );

  const rows: RawSheetRow[] = [];
  for (let r = 1; r < grid.length; r += 1) {
    const line = grid[r] ?? [];
    // Skip fully blank lines.
    if (line.every((cell) => (cell ?? '').trim() === '')) {
      continue;
    }
    const row: RawSheetRow = {};
    fieldByColumn.forEach((field, col) => {
      if (!field) {
        return;
      }
      const value = (line[col] ?? '').trim();
      if (value !== '') {
        row[field] = value;
      }
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Parse a money-ish string that may contain BDT/currency glyphs (`৳`, `$`),
 * `BDT`, thousands separators or spaces. Returns a finite number >= 0, or null
 * when nothing numeric can be recovered.
 */
export function parseMoney(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  // Keep digits, decimal point and minus only.
  const cleaned = raw.replace(/[^\d.-]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === '.') {
    return null;
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/** Parse an optional integer-ish SKU/number; empty -> null. (Not used for sku.) */
export function parseOptionalNumber(
  raw: string | null | undefined,
): number | null {
  return parseMoney(raw);
}

/** Split a semicolon-separated barcode cell, keeping only pure-digit values. */
export function parseBarcodeList(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(';')
    .map((b) => b.trim())
    .filter((b) => /^\d+$/.test(b));
}

/** Normalise an arbitrary string into an uppercase SKU, or null if blank. */
export function normalizeSku(raw: string | null | undefined): string | null {
  if (!raw) {
    return null;
  }
  const upper = raw.trim().toUpperCase();
  return upper === '' ? null : upper;
}

/**
 * Normalise a raw (header-mapped) sheet row into a candidate. `candidateId`
 * and `fileName` are supplied by the caller. Rows missing a usable name or a
 * parseable price are kept but flagged.
 */
export function normalizeSheetRow(
  row: RawSheetRow,
  candidateId: number,
  fileName: string,
): ProductImportCandidate {
  const name = (row.name ?? '').trim();
  const sku = normalizeSku(row.sku);
  const basePrice = parseMoney(row.price);
  const defaultCost = parseOptionalNumber(row.cost);
  const unit = (row.unit ?? '').trim() || 'pcs';
  const categoryName = (row.category ?? '').trim() || null;
  const barcodes = parseBarcodeList(row.barcodes);

  const flags: string[] = [];
  if (name === '') {
    flags.push('missing name');
  }
  if (basePrice === null) {
    flags.push('missing or invalid price');
  }

  return {
    candidateId,
    fileName,
    name,
    sku,
    basePrice,
    defaultCost,
    unit,
    categoryName,
    barcodes,
    flagged: flags.length > 0,
    flags,
  };
}

/** Map an OCR-extracted product into a normalised candidate. */
export function mapOcrProduct(
  product: OcrExtractedProduct,
  candidateId: number,
  fileName: string,
): ProductImportCandidate {
  const name = (product.name ?? '').trim();
  const sku = normalizeSku(product.sku);
  const rawPrice = product.price;
  const basePrice =
    typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice >= 0
      ? rawPrice
      : null;
  const unit = (product.unit ?? '').trim() || 'pcs';
  const barcodes = parseBarcodeList(
    Array.isArray(product.barcodes) ? product.barcodes.join(';') : null,
  );

  const flags: string[] = [];
  if (name === '') {
    flags.push('missing name');
  }
  if (basePrice === null) {
    flags.push('missing or invalid price');
  }

  return {
    candidateId,
    fileName,
    name,
    sku,
    basePrice,
    defaultCost: null,
    unit,
    categoryName: null,
    barcodes,
    flagged: flags.length > 0,
    flags,
  };
}
