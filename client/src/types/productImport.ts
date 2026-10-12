// Types for the product-import API (POST /product-import/*).
// Mirrors the NestJS contract exactly; kept separate from server code so the
// UI can be built before the backend is fully live.

/** How the server classified an uploaded file. */
export type ImportFileKind = 'sheet' | 'ocr';

/** Per-file status returned by the preview endpoints. */
export interface ImportFileStatus {
  name: string;
  kind: ImportFileKind;
  /** Present when the file could not be processed (e.g. "OCR service not configured"). */
  error?: string | null;
}

/** A parsed product candidate proposed by the importer. */
export interface ImportCandidate {
  candidateId: number;
  name: string;
  sku: string | null;
  unit: string;
  basePrice: number;
  defaultCost: number | null;
  categoryName: string | null;
  barcodes: string[];
  sourceFile: string;
  /** Warnings raised by the importer (missing fields, duplicates, etc). */
  issues: string[];
}

/** Response of POST /product-import/preview and GET /product-import/preview/:uploadId. */
export interface ProductImportPreview {
  uploadId: string;
  files: ImportFileStatus[];
  candidates: ImportCandidate[];
  total: number;
}

/** A product row that was successfully created on commit. */
export interface ImportCreatedItem {
  id: string;
  name: string;
  sku: string | null;
}

/** A candidate that collided with existing data and was not created. */
export interface ImportConflictItem {
  candidateId: number;
  name: string;
  reason: string;
}

/** A candidate that was not imported for a non-conflict reason. Shape is not
 *  fully pinned down by the contract, so extra fields are tolerated. */
export interface ImportSkippedItem {
  candidateId?: number;
  name?: string;
  reason?: string;
}

/** Response of POST /product-import/commit. */
export interface ProductImportCommitResult {
  created: ImportCreatedItem[];
  conflicts: ImportConflictItem[];
  skipped: ImportSkippedItem[];
}
