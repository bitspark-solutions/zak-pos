/**
 * Shapes used by the product-import (catalog onboarding) module.
 *
 * A `ProductImportCandidate` is a normalised, tenant-agnostic row produced by
 * the preview step (from a CSV/XLSX sheet or an OCR'd image/PDF). Candidates
 * are cached in Redis and later materialised into `Product` + `Barcode` rows by
 * the commit step.
 */

export type ImportFileKind = 'sheet' | 'ocr';

export interface ImportFileResult {
  name: string;
  kind: ImportFileKind;
  error?: string;
}

/**
 * A single candidate product row after header-mapping / OCR mapping and
 * normalisation. `basePrice` is `null` when the source had no parseable,
 * non-negative price — such rows are kept but `flagged` for review.
 */
export interface ProductImportCandidate {
  candidateId: number;
  fileName: string;
  name: string;
  sku: string | null;
  basePrice: number | null;
  defaultCost: number | null;
  unit: string;
  categoryName: string | null;
  barcodes: string[];
  flagged: boolean;
  flags: string[];
}

/** Payload persisted in Redis under `pimport:<uploadId>`. */
export interface ImportCachePayload {
  tenantId: string;
  uploadId: string;
  candidates: ProductImportCandidate[];
  createdAt: string;
}

export interface PreviewResult {
  uploadId: string;
  files: ImportFileResult[];
  candidates: ProductImportCandidate[];
  total: number;
}

export interface CreatedProductEntry {
  id: string;
  name: string;
  sku: string;
  note?: string;
}

export interface RejectedEntry {
  candidateId: number;
  name: string;
  reason: string;
}

export interface CommitResult {
  created: CreatedProductEntry[];
  conflicts: RejectedEntry[];
  skipped: RejectedEntry[];
}

/** Raw OCR extract-products response contract. */
export interface OcrExtractedProduct {
  name: string;
  sku: string | null;
  price: number | null;
  unit: string | null;
  barcodes: string[];
}

export interface OcrExtractResponse {
  products: OcrExtractedProduct[];
  raw_text: string;
  engine: string;
  count: number;
}
