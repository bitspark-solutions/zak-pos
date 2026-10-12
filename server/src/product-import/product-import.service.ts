import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { OcrService } from './ocr.service';
import {
  mapOcrProduct,
  mapSheetRows,
  normalizeSheetRow,
} from './product-import.parsing';
import { parseCsvGrid, parseXlsxGrid } from './spreadsheet.parser';
import type { CandidateOverride } from './dto/commit-import.dto';
import type {
  CommitResult,
  CreatedProductEntry,
  ImportCachePayload,
  ImportFileResult,
  PreviewResult,
  ProductImportCandidate,
  RejectedEntry,
} from './interfaces/product-import.interface';

/** Cached-candidate TTL (seconds). */
const IMPORT_TTL_SECONDS = 3600;

/** Defensive per-file size cap (~10MB), mirroring the multer limit. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const SHEET_EXTENSIONS = new Set(['csv', 'xlsx']);
const OCR_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'pdf']);

interface MulterLikeFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Injectable()
export class ProductImportService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly ocrService: OcrService,
  ) {}

  private cacheKey(uploadId: string): string {
    return `pimport:${uploadId}`;
  }

  private tenantIndexKey(tenantId: string): string {
    return `pimport:tenant:${tenantId}`;
  }

  private extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  }

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------

  async preview(
    files: MulterLikeFile[],
    tenantId: string,
  ): Promise<PreviewResult> {
    const uploadId = randomUUID();
    const fileResults: ImportFileResult[] = [];
    const candidates: ProductImportCandidate[] = [];

    for (const file of files) {
      const ext = this.extensionOf(file.originalname);
      const isSheet = SHEET_EXTENSIONS.has(ext);
      const isOcr = OCR_EXTENSIONS.has(ext);

      if (!isSheet && !isOcr) {
        fileResults.push({
          name: file.originalname,
          kind: 'sheet',
          error:
            'Unsupported file type (allowed: csv, xlsx, png, jpeg, webp, pdf)',
        });
        continue;
      }

      // Belt-and-braces size check; multer's limits already reject at upload.
      if (file.buffer.length > MAX_FILE_BYTES) {
        fileResults.push({
          name: file.originalname,
          kind: isSheet ? 'sheet' : 'ocr',
          error: `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit`,
        });
        continue;
      }

      if (isSheet) {
        fileResults.push({ name: file.originalname, kind: 'sheet' });
        candidates.push(...(await this.parseSheet(file, ext)));
        continue;
      }

      // Image / PDF -> OCR.
      const fileResult: ImportFileResult = {
        name: file.originalname,
        kind: 'ocr',
      };
      if (!this.ocrService.isEnabled()) {
        fileResult.error =
          'OCR service not configured (OCR_SERVICE_URL is unset) — image/PDF skipped';
      } else {
        try {
          const response = await this.ocrService.extractProducts({
            buffer: file.buffer,
            originalname: file.originalname,
            mimetype: file.mimetype,
          });
          for (const product of response.products ?? []) {
            candidates.push(mapOcrProduct(product, 0, file.originalname));
          }
        } catch (error) {
          fileResult.error = this.ocrService.describeError(error);
          this.ocrService.logFailure(file.originalname, fileResult.error);
        }
      }
      fileResults.push(fileResult);
    }

    // Re-index candidates so candidateId is a stable 0-based global index.
    const indexed = candidates.map((candidate, index) => ({
      ...candidate,
      candidateId: index,
    }));

    const payload: ImportCachePayload = {
      tenantId,
      uploadId,
      candidates: indexed,
      createdAt: new Date().toISOString(),
    };

    await this.redisService.setJson(
      this.cacheKey(uploadId),
      payload,
      IMPORT_TTL_SECONDS,
    );
    await this.indexUpload(tenantId, uploadId);

    return {
      uploadId,
      files: fileResults,
      candidates: indexed,
      total: indexed.length,
    };
  }

  private async parseSheet(
    file: MulterLikeFile,
    ext: string,
  ): Promise<ProductImportCandidate[]> {
    const grid =
      ext === 'csv'
        ? parseCsvGrid(file.buffer)
        : await parseXlsxGrid(file.buffer);
    const rows = mapSheetRows(grid);
    return rows.map((row) => normalizeSheetRow(row, 0, file.originalname));
  }

  private async indexUpload(tenantId: string, uploadId: string): Promise<void> {
    const key = this.tenantIndexKey(tenantId);
    const existing = (await this.redisService.getJson<string[]>(key)) ?? [];
    const next = Array.from(new Set([...existing, uploadId]));
    await this.redisService.setJson(key, next, IMPORT_TTL_SECONDS);
  }

  // ---------------------------------------------------------------------------
  // Load cached preview
  // ---------------------------------------------------------------------------

  async getPreview(
    uploadId: string,
    tenantId: string,
  ): Promise<ImportCachePayload> {
    const payload = await this.loadCache(uploadId, tenantId);
    return payload;
  }

  private async loadCache(
    uploadId: string,
    tenantId: string,
  ): Promise<ImportCachePayload> {
    const payload = await this.redisService.getJson<ImportCachePayload>(
      this.cacheKey(uploadId),
    );
    // Treat a tenant mismatch as "gone" so we never leak another tenant's data.
    if (!payload || payload.tenantId !== tenantId) {
      throw new NotFoundException(
        `Import preview ${uploadId} not found or expired`,
      );
    }
    return payload;
  }

  // ---------------------------------------------------------------------------
  // Commit
  // ---------------------------------------------------------------------------

  async commit(
    uploadId: string,
    candidateIds: number[],
    tenantId: string,
    overrides: CandidateOverride[] = [],
  ): Promise<CommitResult> {
    const payload = await this.loadCache(uploadId, tenantId);
    const selected = new Set(candidateIds);
    const targets = payload.candidates.filter((candidate) =>
      selected.has(candidate.candidateId),
    );

    const created: CreatedProductEntry[] = [];
    const conflicts: RejectedEntry[] = [];
    const skipped: RejectedEntry[] = [];

    // Inline edits from the review table win over the cached preview values.
    const resolved = this.applyOverrides(targets, overrides, skipped);

    await this.databaseService.withTenant(tenantId, async (tx) => {
      for (const candidate of resolved) {
        // Required-field validation.
        if (candidate.name === '') {
          skipped.push({
            candidateId: candidate.candidateId,
            name: candidate.name || '(unnamed)',
            reason: 'missing name',
          });
          continue;
        }
        if (candidate.basePrice === null) {
          skipped.push({
            candidateId: candidate.candidateId,
            name: candidate.name,
            reason: 'missing or invalid price',
          });
          continue;
        }

        // Resolve SKU: supplied (conflict-check) or generated (uniqueness-check).
        let sku: string;
        if (candidate.sku) {
          const existing = await tx.product.findFirst({
            where: { tenantId, sku: candidate.sku },
            select: { id: true },
          });
          if (existing) {
            conflicts.push({
              candidateId: candidate.candidateId,
              name: candidate.name,
              reason: `SKU ${candidate.sku} already exists`,
            });
            continue;
          }
          sku = candidate.sku;
        } else {
          const generated = await this.generateUniqueSku(
            tx,
            tenantId,
            candidate.name,
          );
          if (!generated) {
            conflicts.push({
              candidateId: candidate.candidateId,
              name: candidate.name,
              reason: 'could not generate a unique SKU',
            });
            continue;
          }
          sku = generated;
        }

        // Resolve category name (case-insensitive) if supplied.
        let categoryId: string | null = null;
        let note: string | undefined;
        if (candidate.categoryName) {
          const category = await tx.category.findFirst({
            where: {
              tenantId,
              name: { equals: candidate.categoryName, mode: 'insensitive' },
            },
            select: { id: true },
          });
          if (category) {
            categoryId = category.id;
          } else {
            note = `category "${candidate.categoryName}" not found — left uncategorised`;
          }
        }

        try {
          const product = await tx.product.create({
            data: {
              tenantId,
              name: candidate.name,
              sku,
              unit: candidate.unit,
              basePrice: new Prisma.Decimal(candidate.basePrice),
              defaultCost:
                candidate.defaultCost !== null
                  ? new Prisma.Decimal(candidate.defaultCost)
                  : new Prisma.Decimal(0),
              categoryId,
            },
            select: { id: true, name: true, sku: true },
          });

          created.push({
            id: product.id,
            name: product.name,
            sku: product.sku,
            ...(note ? { note } : {}),
          });

          // Barcode rows for created products only.
          for (let i = 0; i < candidate.barcodes.length; i += 1) {
            const value = candidate.barcodes[i];
            if (!value) {
              continue;
            }
            await tx.barcode.create({
              data: {
                productId: product.id,
                type: barcodeTypeFor(value),
                value,
                isPrimary: i === 0,
              },
            });
          }
        } catch (error) {
          if (isUniqueViolation(error)) {
            conflicts.push({
              candidateId: candidate.candidateId,
              name: candidate.name,
              reason: `SKU ${sku} already exists`,
            });
            continue;
          }
          throw error;
        }
      }
    });

    // Cache consumed — drop the payload (and prune it from the tenant index).
    await this.redisService.del(this.cacheKey(uploadId));
    await this.pruneIndex(tenantId, uploadId);

    return { created, conflicts, skipped };
  }

  /**
   * Overlay the caller's inline edits onto the cached candidates.
   *
   * Only fields present on the override replace the cached value, and a blank
   * SKU/unit is normalised back to "not supplied" so commit falls back to its
   * usual behaviour (generated SKU, cached unit handling). Edits that cannot be
   * honoured — a whitespace-only name or a non-finite/negative price — are
   * recorded in `skipped` and dropped from the returned list.
   */
  private applyOverrides(
    candidates: ProductImportCandidate[],
    overrides: CandidateOverride[],
    skipped: RejectedEntry[],
  ): ProductImportCandidate[] {
    if (overrides.length === 0) {
      return candidates;
    }

    const byId = new Map<number, CandidateOverride>();
    for (const override of overrides) {
      byId.set(override.candidateId, override);
    }

    const resolved: ProductImportCandidate[] = [];
    for (const candidate of candidates) {
      const override = byId.get(candidate.candidateId);
      if (!override) {
        resolved.push(candidate);
        continue;
      }

      const edited: ProductImportCandidate = { ...candidate };

      if (override.name !== undefined) {
        // A blank name stays blank so the required-field check below reports it.
        edited.name = override.name.trim();
      }
      if (override.sku !== undefined) {
        // Same normalisation as the preview step: blank -> generate, else uppercase.
        const sku = override.sku.trim().toUpperCase();
        edited.sku = sku === '' ? null : sku;
      }
      if (override.unit !== undefined) {
        const unit = override.unit.trim();
        edited.unit = unit === '' ? candidate.unit : unit;
      }
      if (override.basePrice !== undefined) {
        if (!Number.isFinite(override.basePrice) || override.basePrice < 0) {
          skipped.push({
            candidateId: candidate.candidateId,
            name: edited.name || '(unnamed)',
            reason: 'invalid price',
          });
          continue;
        }
        edited.basePrice = override.basePrice;
      }

      resolved.push(edited);
    }

    return resolved;
  }

  private async generateUniqueSku(
    tx: Prisma.TransactionClient,
    tenantId: string,
    name: string,
  ): Promise<string | null> {
    const slug = slugify(name);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(3).toString('hex').toUpperCase();
      const candidate = `${slug}-${suffix}`.slice(0, 64);
      const existing = await tx.product.findFirst({
        where: { tenantId, sku: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    return null;
  }

  private async pruneIndex(tenantId: string, uploadId: string): Promise<void> {
    const key = this.tenantIndexKey(tenantId);
    const existing = await this.redisService.getJson<string[]>(key);
    if (!existing) {
      return;
    }
    const next = existing.filter((id) => id !== uploadId);
    if (next.length === 0) {
      await this.redisService.del(key);
    } else {
      await this.redisService.setJson(key, next, IMPORT_TTL_SECONDS);
    }
  }
}

/** Infer the barcode type from the digit-string length. */
export function barcodeTypeFor(value: string): string {
  if (value.length === 13) {
    return 'ean13';
  }
  if (value.length === 12) {
    return 'upc';
  }
  return 'code128';
}

/** Lowercase, alphanumerics joined by single hyphens (for SKU generation). */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'sku' : slug;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
