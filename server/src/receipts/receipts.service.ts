import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { OcrService } from '../product-import/ocr.service';
import type { CommitReceiptDto } from './dto/commit-receipt.dto';
import type {
  ReceiptCommitResult,
  ReceiptDraftLine,
  ReceiptDraftPayload,
  ReceiptDraftResponse,
  ReceiptSupplierOption,
} from './interfaces/receipts.interface';

/** Cached-draft TTL (seconds) — same convention as product-import. */
const RECEIPT_TTL_SECONDS = 3600;

/** Max supplier suggestions surfaced to the review UI. */
const MAX_SUPPLIER_SUGGESTIONS = 5;

/** Subset of Express.Multer.File the digitize flow actually reads. */
interface ReceiptUploadFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

/** Context the commit step needs from the authenticated user (JWT claims). */
export interface ReceiptUserClaims {
  shopId?: string;
}

type ProductMatch = { id: string; name: string } | null;

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly ocrService: OcrService,
  ) {}

  private cacheKey(draftId: string): string {
    return `rdigit:${draftId}`;
  }

  // ---------------------------------------------------------------------------
  // Digitize (OCR -> reviewable draft)
  // ---------------------------------------------------------------------------

  async digitize(
    file: ReceiptUploadFile,
    tenantId: string,
  ): Promise<ReceiptDraftResponse> {
    if (!this.ocrService.isEnabled()) {
      throw new ServiceUnavailableException(
        'OCR service not configured (OCR_SERVICE_URL is unset) — receipt digitization is unavailable',
      );
    }

    const receipt = await this.ocrService.extractReceipt(
      file as Express.Multer.File,
    );
    const items = receipt.items ?? [];

    const { lines, supplierSuggestions } =
      await this.databaseService.withTenant(tenantId, async (tx) => {
        const matched: ReceiptDraftLine[] = [];
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          const product = await this.matchProduct(tx, tenantId, item.name);
          matched.push({
            lineId: index,
            name: item.name,
            qty: item.qty,
            unitPrice: item.unit_price,
            lineTotal: item.line_total,
            matchedProductId: product ? product.id : null,
            matchedProductName: product ? product.name : null,
          });
        }
        const suggestions = await this.suggestSuppliers(
          tx,
          tenantId,
          receipt.vendor,
        );
        return { lines: matched, supplierSuggestions: suggestions };
      });

    const draftId = randomUUID();
    const payload: ReceiptDraftPayload = {
      tenantId,
      draftId,
      vendor: receipt.vendor,
      documentDate: receipt.document_date,
      currency: receipt.currency,
      subtotal: receipt.subtotal,
      discount: receipt.discount,
      tax: receipt.tax,
      total: receipt.total,
      engine: receipt.engine,
      lines,
      supplierSuggestions,
      createdAt: new Date().toISOString(),
    };

    await this.redisService.setJson(
      this.cacheKey(draftId),
      payload,
      RECEIPT_TTL_SECONDS,
    );

    return this.toDraftResponse(payload);
  }

  /**
   * Match one receipt item to a tenant product: exact case-insensitive name,
   * then SKU, then barcode value (when the receipt line is actually a code),
   * then a case-insensitive `contains` fallback.
   */
  private async matchProduct(
    tx: Prisma.TransactionClient,
    tenantId: string,
    rawName: string,
  ): Promise<ProductMatch> {
    const name = (rawName ?? '').trim();
    if (name === '') {
      return null;
    }

    const byName = await tx.product.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (byName) {
      return byName;
    }

    const bySku = await tx.product.findFirst({
      where: { tenantId, sku: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (bySku) {
      return bySku;
    }

    const byBarcode = await tx.barcode.findFirst({
      where: { value: name, product: { tenantId } },
      select: { product: { select: { id: true, name: true } } },
    });
    if (byBarcode) {
      return byBarcode.product;
    }

    return tx.product.findFirst({
      where: { tenantId, name: { contains: name, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
  }

  /** Exact case-insensitive vendor match first, then `contains`, max 5. */
  private async suggestSuppliers(
    tx: Prisma.TransactionClient,
    tenantId: string,
    vendor: string | null,
  ): Promise<ReceiptSupplierOption[]> {
    const name = (vendor ?? '').trim();
    if (name === '') {
      return [];
    }

    const exact = await tx.supplier.findMany({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: MAX_SUPPLIER_SUGGESTIONS,
    });
    if (exact.length >= MAX_SUPPLIER_SUGGESTIONS) {
      return exact;
    }

    const partial = await tx.supplier.findMany({
      where: {
        tenantId,
        name: { contains: name, mode: 'insensitive' },
        NOT: { id: { in: exact.map((supplier) => supplier.id) } },
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: MAX_SUPPLIER_SUGGESTIONS - exact.length,
    });
    return [...exact, ...partial];
  }

  // ---------------------------------------------------------------------------
  // Load cached draft / supplier picker
  // ---------------------------------------------------------------------------

  async getDraft(
    draftId: string,
    tenantId: string,
  ): Promise<ReceiptDraftResponse> {
    const payload = await this.loadDraft(draftId, tenantId);
    return this.toDraftResponse(payload);
  }

  private async loadDraft(
    draftId: string,
    tenantId: string,
  ): Promise<ReceiptDraftPayload> {
    const payload = await this.redisService.getJson<ReceiptDraftPayload>(
      this.cacheKey(draftId),
    );
    // Treat a tenant mismatch as "gone" so we never leak another tenant's data.
    if (!payload || payload.tenantId !== tenantId) {
      throw new NotFoundException(
        `Receipt draft ${draftId} not found or expired`,
      );
    }
    return payload;
  }

  private toDraftResponse(payload: ReceiptDraftPayload): ReceiptDraftResponse {
    return {
      draftId: payload.draftId,
      vendor: payload.vendor,
      documentDate: payload.documentDate,
      currency: payload.currency,
      subtotal: payload.subtotal,
      discount: payload.discount,
      tax: payload.tax,
      total: payload.total,
      engine: payload.engine,
      lines: payload.lines,
      supplierSuggestions: payload.supplierSuggestions,
    };
  }

  async listSuppliers(tenantId: string): Promise<ReceiptSupplierOption[]> {
    return this.databaseService.withTenant(tenantId, (tx) =>
      tx.supplier.findMany({
        where: { tenantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Commit (draft -> Purchase + PurchaseLines, optional restock)
  // ---------------------------------------------------------------------------

  async commit(
    dto: CommitReceiptDto,
    tenantId: string,
    user: ReceiptUserClaims,
  ): Promise<ReceiptCommitResult> {
    // Existence check first so an expired draft 404s before any DB work.
    const draft = await this.loadDraft(dto.draftId, tenantId);

    const dueDate = this.parseDate(dto.date);

    const result = await this.databaseService.withTenant(
      tenantId,
      async (tx): Promise<ReceiptCommitResult> => {
        // --- shop: JWT claim first, else the tenant's oldest shop.
        let shopId = user.shopId;
        if (!shopId) {
          const shop = await tx.shop.findFirst({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          });
          shopId = shop?.id;
        }
        if (!shopId) {
          throw new BadRequestException(
            'No shop available for this tenant — create a shop before committing receipts',
          );
        }

        // --- supplier resolution.
        const supplierId = await this.resolveSupplier(tx, tenantId, dto);

        // --- every referenced product must exist in tenant scope.
        const ids = Array.from(
          new Set(dto.lines.map((line) => line.productId)),
        );
        const found = await tx.product.findMany({
          where: { tenantId, id: { in: ids } },
          select: { id: true },
        });
        const known = new Set(found.map((product) => product.id));
        const badLine = dto.lines.find((line) => !known.has(line.productId));
        if (badLine) {
          throw new BadRequestException(
            `Line ${badLine.lineId}: product ${badLine.productId} not found in this tenant`,
          );
        }

        // --- amounts are recomputed server-side; OCR numbers are never trusted.
        let subtotal = new Prisma.Decimal(0);
        const lineDecimals = dto.lines.map((line) => {
          const qty = new Prisma.Decimal(line.qty);
          const unitCost = new Prisma.Decimal(line.unitCost);
          const lineTotal = qty.mul(unitCost).toDecimalPlaces(2);
          subtotal = subtotal.plus(lineTotal);
          return { qty, unitCost, lineTotal };
        });

        let discount =
          dto.discount !== undefined
            ? new Prisma.Decimal(dto.discount)
            : new Prisma.Decimal(0);
        if (discount.isNegative()) {
          discount = new Prisma.Decimal(0);
        }
        if (discount.gt(subtotal)) {
          discount = subtotal;
        }
        const tax =
          dto.tax !== undefined && !new Prisma.Decimal(dto.tax).isNegative()
            ? new Prisma.Decimal(dto.tax)
            : new Prisma.Decimal(0);
        const total = subtotal.minus(discount).plus(tax);

        const currency = this.resolveCurrency(draft.currency);
        const status = dto.receive === true ? 'received' : 'draft';

        const purchase = await tx.purchase.create({
          data: {
            shopId,
            supplierId,
            status,
            currency,
            subtotal,
            discount,
            tax,
            total,
            notes: dto.notes ?? null,
            dueDate,
          },
          select: { id: true, status: true, total: true },
        });

        for (let index = 0; index < dto.lines.length; index += 1) {
          const line = dto.lines[index];
          const amounts = lineDecimals[index];
          await tx.purchaseLine.create({
            data: {
              purchaseId: purchase.id,
              productId: line.productId,
              qty: amounts.qty,
              unitCost: amounts.unitCost,
              discount: new Prisma.Decimal(0),
              taxAmount: new Prisma.Decimal(0),
              lineTotal: amounts.lineTotal,
            },
          });
        }

        // --- receive=true restocks in the SAME transaction (same semantics
        // as inventory.adjustStock IN: missing rows are created).
        if (dto.receive === true) {
          for (const line of dto.lines) {
            await this.restockProduct(tx, shopId, tenantId, purchase.id, line);
          }
        }

        return {
          purchaseId: purchase.id,
          status: purchase.status,
          linesCreated: dto.lines.length,
          total: Number(purchase.total),
        };
      },
    );

    // Draft consumed — drop the cache on success.
    await this.redisService.del(this.cacheKey(dto.draftId));
    return result;
  }

  private async resolveSupplier(
    tx: Prisma.TransactionClient,
    tenantId: string,
    dto: CommitReceiptDto,
  ): Promise<string> {
    if (dto.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { tenantId, id: dto.supplierId },
        select: { id: true },
      });
      if (!supplier) {
        throw new BadRequestException(
          `Supplier ${dto.supplierId} does not exist in this tenant`,
        );
      }
      return supplier.id;
    }

    const name = (dto.newSupplierName ?? '').trim();
    if (name === '') {
      throw new BadRequestException(
        'Provide supplierId or newSupplierName to commit this receipt',
      );
    }
    const created = await tx.supplier.create({
      data: { tenantId, name },
      select: { id: true },
    });
    return created.id;
  }

  private async restockProduct(
    tx: Prisma.TransactionClient,
    shopId: string,
    tenantId: string,
    purchaseId: string,
    line: { productId: string; qty: number; unitCost: number },
  ): Promise<void> {
    const inventory = await tx.inventory.findFirst({
      where: {
        shopId,
        productId: line.productId,
        variantId: null,
        product: { tenantId },
      },
    });
    if (!inventory) {
      // Same semantics as inventory.adjustStock with type IN: a purchase is
      // how a brand-new product (e.g. catalog import) gets its stock row.
      await tx.inventory.create({
        data: {
          shopId,
          productId: line.productId,
          variantId: null,
          quantityOnHand: line.qty,
          avgCost: line.unitCost,
        },
      });
    } else {
      const currentQty = Number(inventory.quantityOnHand);
      const newQuantity = currentQty + line.qty;
      const newAvgCost =
        (Number(inventory.avgCost) * currentQty + line.unitCost * line.qty) /
        newQuantity;
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantityOnHand: newQuantity, avgCost: newAvgCost },
      });
    }

    await tx.inventoryMovement.create({
      data: {
        tenantId,
        shopId,
        productId: line.productId,
        variantId: null,
        movementType: 'IN',
        quantity: line.qty,
        unitCost: line.unitCost,
        referenceType: 'purchase',
        referenceId: purchaseId,
      },
    });
  }

  /** ISO date guard: absent -> null, unparseable -> 400. */
  private parseDate(value: string | undefined): Date | null {
    if (value === undefined || value.trim() === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }
    return parsed;
  }

  private resolveCurrency(raw: string | null): string {
    const currency = (raw ?? '').trim().toUpperCase();
    return currency === '' ? 'BDT' : currency.slice(0, 8);
  }
}
