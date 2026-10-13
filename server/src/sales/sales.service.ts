import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import type { Cart } from '../cart/interfaces/cart.interface';
import { InventoryService } from '../inventory/inventory.service';
import { TenantService } from '../auth/tenant.service';
import { ReceiptPdfService } from '../pdf/receipt-pdf.service';
import type { ReceiptPdfPayload } from '../pdf/interfaces/receipt-pdf.interface';
import type {
  CommitSaleDto,
  RefundSaleDto,
  ISale,
  ISaleLine,
} from './interfaces/sales.interface';

/**
 * Money columns come back from Prisma as `Decimal`; specs / plain numbers are
 * accepted too so the mapping stays structural instead of nominal.
 */
type DecimalValue = Prisma.Decimal | number | string;

/**
 * The `sales` row shape this service reads (a Prisma `Sale`; extra properties
 * such as the optional `saleLines` include are allowed but unused here).
 */
interface SaleRecord {
  id: string;
  tenantId: string;
  shopId: string;
  customerId: string | null;
  cashierId: string;
  status: string;
  channel: string;
  subtotal: DecimalValue;
  discount: DecimalValue;
  tax: DecimalValue;
  total: DecimalValue;
  paymentStatus: string;
  currency: string;
  createdAt: Date;
  postedAt: Date | null;
}

/**
 * The `sale_lines` rows this service reads for a refund (a Prisma `SaleLine`).
 */
interface SaleLineRecord {
  id: string;
  productId: string;
  variantId: string | null;
  qty: DecimalValue;
  lineTotal: DecimalValue;
}

/**
 * What a refund puts back on the shelf: the sale lines being returned with the
 * quantity refunded per line.
 */
interface RestockItem {
  productId: string;
  variantId: string | null;
  quantity: number;
}

/**
 * A refund resolved into the fraction of the sale money returned and the
 * quantities going back into stock. Computed once in `refund` and shared by
 * the reversal journal and the physical restock so they never diverge.
 */
interface RefundScope {
  ratio: number;
  restock: RestockItem[];
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
    private readonly tenantService: TenantService,
    private readonly receiptPdf: ReceiptPdfService,
  ) {}

  async commitSale(
    dto: CommitSaleDto,
    tenantId: string,
  ): Promise<{ sale: ISale; lines: ISaleLine[] }> {
    // Get cart (tenant ownership is verified inside findByToken)
    const cart = await this.cartService.findByToken(dto.cartToken, tenantId);

    if (cart.status !== 'tendered') {
      throw new BadRequestException('Cart must be tendered before commit');
    }

    if (cart.lines.length === 0) {
      throw new BadRequestException('Cannot commit empty cart');
    }

    // Verify payment amount
    const amountTendered = dto.amountTendered || cart.total;
    if (amountTendered < cart.total) {
      throw new BadRequestException('Insufficient payment amount');
    }

    // withTenant provides the outer interactive transaction with app.tenant_id set (RLS active).
    return this.databaseService.withTenant(tenantId, async (tx) => {
      // 1. Create Sale record
      const sale = await tx.sale.create({
        data: {
          tenantId: cart.tenantId,
          shopId: cart.shopId,
          customerId: cart.customerId,
          cashierId: cart.cashierId,
          status: 'completed',
          channel: 'pos',
          subtotal: cart.subtotal,
          discount: cart.discount,
          tax: cart.tax,
          total: cart.total,
          paymentStatus: 'paid',
          currency: 'BDT',
          postedAt: new Date(),
        },
      });

      // 2. Create SaleLines
      const saleLines: ISaleLine[] = [];
      for (const line of cart.lines) {
        const saleLine = await tx.saleLine.create({
          data: {
            saleId: sale.id,
            tenantId: cart.tenantId,
            productId: line.productId,
            variantId: line.variantId,
            qty: line.qty,
            unitPrice: line.unitPrice,
            discount: line.discount,
            taxId: line.taxId,
            taxAmount: line.taxAmount,
            lineTotal: line.lineTotal,
          },
        });

        saleLines.push({
          id: saleLine.id,
          saleId: saleLine.saleId,
          productId: saleLine.productId,
          variantId: saleLine.variantId || undefined,
          qty: Number(saleLine.qty),
          unitPrice: Number(saleLine.unitPrice),
          discount: Number(saleLine.discount),
          taxId: saleLine.taxId || undefined,
          taxAmount: Number(saleLine.taxAmount),
          lineTotal: Number(saleLine.lineTotal),
        });
      }

      // 3. Deduct inventory
      try {
        await this.inventoryService.deductStock(
          cart.shopId,
          cart.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            quantity: line.qty,
          })),
          'SALE',
          sale.id,
          cart.tenantId,
          tx,
        );
      } catch (error) {
        throw new BadRequestException(
          `Failed to deduct inventory: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      // 4. Create Payment record
      await tx.payment.create({
        data: {
          tenantId: cart.tenantId,
          saleId: sale.id,
          customerId: cart.customerId,
          direction: 'in',
          method: dto.paymentMethod,
          amount: amountTendered,
          currency: 'BDT',
          reference: dto.paymentReference,
          postedAt: new Date(),
        },
      });

      // 5. Create Journal entries for the sale
      await this.createSaleJournalEntries(tx, cart, sale.id, dto.paymentMethod);

      // 6. Complete the cart
      await this.cartService.complete(dto.cartToken, tenantId);

      return { sale: this.mapToSale(sale), lines: saleLines };
    });
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async createSaleJournalEntries(
    tx: Prisma.TransactionClient,
    cart: Cart,
    saleId: string,
    paymentMethod: string,
  ): Promise<void> {
    const tenantId = cart.tenantId;
    const accounts = await this.tenantService.seedAccounts(tx, tenantId);
    const now = new Date();

    // Revenue journal: Dr Cash (total) / Cr Sales Revenue (net of discount) + Cr VAT Payable
    const journal = await tx.journal.create({
      data: {
        tenantId,
        date: now,
        description: `Sale ${saleId}`,
        source: 'SALE',
        referenceType: 'sale',
        referenceId: saleId,
        createdBy: cart.cashierId,
        status: 'posted',
      },
    });

    const revenue = this.round2(cart.subtotal - cart.discount);
    const vat = this.round2(cart.tax);

    await tx.journalLine.create({
      data: {
        journalId: journal.id,
        accountId: accounts.get('1000')!,
        debit: cart.total,
        credit: 0,
        memo: `Payment method: ${paymentMethod}`,
      },
    });

    if (revenue > 0) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: accounts.get('4000')!,
          debit: 0,
          credit: revenue,
        },
      });
    }

    if (vat > 0) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: accounts.get('2200')!,
          debit: 0,
          credit: vat,
        },
      });
    }

    // COGS journal at real weighted-average cost from inventory
    let totalCogs = 0;
    for (const line of cart.lines) {
      const inventory = await tx.inventory.findFirst({
        where: {
          shopId: cart.shopId,
          productId: line.productId,
          variantId: line.variantId || null,
          product: { tenantId },
        },
      });

      if (inventory) {
        totalCogs += line.qty * Number(inventory.avgCost);
      } else {
        this.logger.warn(
          `No inventory record for product ${line.productId} in shop ${cart.shopId}; COGS excludes this line`,
        );
      }
    }
    totalCogs = this.round2(totalCogs);

    if (totalCogs > 0) {
      const cogsJournal = await tx.journal.create({
        data: {
          tenantId,
          date: now,
          description: `COGS for Sale ${saleId}`,
          source: 'COGS',
          referenceType: 'sale',
          referenceId: saleId,
          createdBy: cart.cashierId,
          status: 'posted',
        },
      });

      await tx.journalLine.create({
        data: {
          journalId: cogsJournal.id,
          accountId: accounts.get('5000')!,
          debit: totalCogs,
          credit: 0,
        },
      });

      await tx.journalLine.create({
        data: {
          journalId: cogsJournal.id,
          accountId: accounts.get('1500')!,
          debit: 0,
          credit: totalCogs,
        },
      });
    }
  }

  /**
   * Reverses the journals `createSaleJournalEntries` posted for a sale:
   * Dr Sales Revenue + Dr VAT Payable / Cr Cash, plus Dr Inventory / Cr COGS
   * for the goods the refund puts back on the shelf.
   *
   * Amounts are proportional to what the refund actually returns: without
   * `dto.lines` the full sale is reversed, with them only the refunded
   * fraction of money and cost is booked.
   */
  private async createRefundJournalEntries(
    tx: Prisma.TransactionClient,
    sale: SaleRecord,
    dto: RefundSaleDto,
    scope: RefundScope,
  ): Promise<void> {
    const tenantId = sale.tenantId;
    const accounts = await this.tenantService.seedAccounts(tx, tenantId);
    const now = new Date();

    const refundTotal = this.round2(Number(sale.total) * scope.ratio);
    const refundVat = Math.min(
      this.round2(Number(sale.tax) * scope.ratio),
      refundTotal,
    );
    // Debits have to equal the cash paid out, so the revenue reversal absorbs
    // whatever rounding the net/VAT split leaves behind.
    const refundRevenue = this.round2(refundTotal - refundVat);

    // Revenue reversal: Dr Sales Revenue + Dr VAT Payable / Cr Cash
    const journal = await tx.journal.create({
      data: {
        tenantId,
        date: now,
        description: `Refund ${sale.id}`,
        source: 'REFUND',
        referenceType: 'sale',
        referenceId: sale.id,
        createdBy: sale.cashierId,
        status: 'posted',
      },
    });

    if (refundRevenue > 0) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: accounts.get('4000')!,
          debit: refundRevenue,
          credit: 0,
          memo: `Refund reason: ${dto.reason}`,
        },
      });
    }

    if (refundVat > 0) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: accounts.get('2200')!,
          debit: refundVat,
          credit: 0,
        },
      });
    }

    await tx.journalLine.create({
      data: {
        journalId: journal.id,
        accountId: accounts.get('1000')!,
        debit: 0,
        credit: refundTotal,
        memo: `Refund method: ${dto.refundMethod}`,
      },
    });

    // Restock reversal: Dr Inventory / Cr COGS at weighted-average cost
    let restockCost = 0;
    for (const item of scope.restock) {
      const inventory = await tx.inventory.findFirst({
        where: {
          shopId: sale.shopId,
          productId: item.productId,
          variantId: item.variantId,
          product: { tenantId },
        },
      });

      if (inventory) {
        restockCost += item.quantity * Number(inventory.avgCost);
      } else {
        this.logger.warn(
          `No inventory record for product ${item.productId} in shop ${sale.shopId}; refund restock cost excludes this line`,
        );
      }
    }
    restockCost = this.round2(restockCost);

    if (restockCost > 0) {
      const restockJournal = await tx.journal.create({
        data: {
          tenantId,
          date: now,
          description: `Restock for Refund ${sale.id}`,
          source: 'REFUND',
          referenceType: 'sale',
          referenceId: sale.id,
          createdBy: sale.cashierId,
          status: 'posted',
        },
      });

      await tx.journalLine.create({
        data: {
          journalId: restockJournal.id,
          accountId: accounts.get('1500')!,
          debit: restockCost,
          credit: 0,
        },
      });

      await tx.journalLine.create({
        data: {
          journalId: restockJournal.id,
          accountId: accounts.get('5000')!,
          debit: 0,
          credit: restockCost,
        },
      });
    }
  }

  /**
   * Resolves a refund into the fraction of the sale money returned and the
   * quantities going back into stock.
   */
  private getRefundScope(
    saleTotal: number,
    saleLines: SaleLineRecord[],
    requestedLines?: { lineId: string; qty: number }[],
  ): RefundScope {
    if (!requestedLines || requestedLines.length === 0) {
      return {
        ratio: 1,
        restock: saleLines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: Number(line.qty),
        })),
      };
    }

    const linesById = new Map(saleLines.map((line) => [line.id, line]));
    const restock: RestockItem[] = [];
    let refundedAmount = 0;

    for (const requested of requestedLines) {
      const line = linesById.get(requested.lineId);
      if (!line) {
        throw new BadRequestException(
          `Sale line ${requested.lineId} does not belong to this sale`,
        );
      }

      const quantity = Math.min(requested.qty, Number(line.qty));
      if (quantity <= 0) continue;

      refundedAmount += (Number(line.lineTotal) * quantity) / Number(line.qty);
      restock.push({
        productId: line.productId,
        variantId: line.variantId,
        quantity,
      });
    }

    const ratio =
      saleTotal > 0 ? Math.min(this.round2(refundedAmount / saleTotal), 1) : 1;

    return { ratio, restock };
  }

  async findAll(tenantId: string, shopId?: string): Promise<ISale[]> {
    const where: Prisma.SaleWhereInput = { tenantId };
    if (shopId) where.shopId = shopId;

    const sales = await this.databaseService.withTenant(tenantId, (tx) =>
      tx.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );

    return sales.map((s) => this.mapToSale(s));
  }

  async findById(id: string, tenantId: string): Promise<ISale> {
    const sale = await this.databaseService.withTenant(tenantId, (tx) =>
      tx.sale.findFirst({
        where: { id, tenantId },
        include: { saleLines: true },
      }),
    );

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    return this.mapToSale(sale);
  }

  async findByIdWithLines(
    id: string,
    tenantId: string,
  ): Promise<{ sale: ISale; lines: ISaleLine[] }> {
    const sale = await this.databaseService.withTenant(tenantId, (tx) =>
      tx.sale.findFirst({
        where: { id, tenantId },
        include: { saleLines: true },
      }),
    );

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    return {
      sale: this.mapToSale(sale),
      lines: sale.saleLines.map((sl) => ({
        id: sl.id,
        saleId: sl.saleId,
        productId: sl.productId,
        variantId: sl.variantId || undefined,
        qty: Number(sl.qty),
        unitPrice: Number(sl.unitPrice),
        discount: Number(sl.discount),
        taxId: sl.taxId || undefined,
        taxAmount: Number(sl.taxAmount),
        lineTotal: Number(sl.lineTotal),
      })),
    };
  }

  /**
   * Render a tenant-scoped sale as a thermal-slip receipt PDF, so a cashier can
   * print or share the slip before formalizing an invoice. Uses the same
   * renderer as the invoice PDF; the sale id stands in for a document number.
   * Cross-tenant ids resolve to no row under RLS, hence a 404.
   */
  async getSaleReceiptPdf(
    id: string,
    tenantId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    return this.databaseService.withTenant(tenantId, async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
        include: {
          shop: { select: { name: true, address: true } },
          customer: { select: { name: true, phone: true } },
          saleLines: {
            select: {
              qty: true,
              unitPrice: true,
              lineTotal: true,
              product: { select: { name: true } },
            },
          },
          payments: { select: { method: true } },
        },
      });

      if (!sale) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }

      const payload: ReceiptPdfPayload = {
        shopName: sale.shop.name,
        shopAddress: sale.shop.address,
        documentNumber: sale.id,
        documentTitle: 'SALE RECEIPT',
        date: sale.postedAt ?? sale.createdAt,
        customerName: sale.customer?.name ?? null,
        customerPhone: sale.customer?.phone ?? null,
        lines: sale.saleLines.map((line) => ({
          name: line.product.name,
          qty: Number(line.qty),
          unitPrice: Number(line.unitPrice),
          amount: Number(line.lineTotal),
        })),
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        total: Number(sale.total),
        paymentMethod: sale.payments[0]?.method ?? null,
        currency: sale.currency,
      };

      const buffer = await this.receiptPdf.render(payload);
      return { buffer, filename: `sale-${sale.id}.pdf` };
    });
  }

  async refund(
    id: string,
    dto: RefundSaleDto,
    tenantId: string,
  ): Promise<ISale> {
    // One RLS-scoped transaction: read → insert return → flip sale status.
    return this.databaseService.withTenant(tenantId, async (tx) => {
      const sale = await tx.sale.findFirst({
        where: { id, tenantId },
      });

      if (!sale) {
        throw new NotFoundException(`Sale with ID ${id} not found`);
      }

      if (sale.status !== 'completed') {
        throw new BadRequestException('Can only refund completed sales');
      }

      if (sale.paymentStatus !== 'paid') {
        throw new BadRequestException('Can only refund paid sales');
      }

      // Create return record (returns are RLS-scoped via the parent sale)
      await tx.return.create({
        data: {
          saleId: id,
          subtotal: sale.subtotal,
          tax: sale.tax,
          total: sale.total,
          refundMethod: dto.refundMethod,
          handlerId: sale.cashierId,
          status: 'posted',
          postedAt: new Date(),
        },
      });

      // Update sale status
      const updatedSale = await tx.sale.update({
        where: { id },
        data: {
          status: 'refunded',
          paymentStatus: 'refunded',
        },
      });

      // Resolve the refund (money returned + quantities coming back) once, so
      // the reversal journal and the physical restock use the exact same scope.
      const saleLines = await tx.saleLine.findMany({
        where: { saleId: sale.id },
      });
      const scope = this.getRefundScope(
        Number(sale.total),
        saleLines,
        dto.lines,
      );

      // Reverse the journals the sale posted (same tenant-scoped transaction)
      await this.createRefundJournalEntries(tx, sale, dto, scope);

      // Put the refunded quantities back on the shelf and record IN movements
      // (same transaction; missing inventory rows are skipped with a warning,
      // matching the cost-exclusion the refund journal already applies).
      await this.inventoryService.restoreStock(
        sale.shopId,
        scope.restock,
        'REFUND',
        sale.id,
        tenantId,
        tx,
      );

      return this.mapToSale(updatedSale);
    });
  }

  private mapToSale(sale: SaleRecord): ISale {
    return {
      id: sale.id,
      tenantId: sale.tenantId,
      shopId: sale.shopId,
      // Prisma exposes nullable columns as `null`; ISale declares them optional,
      // so the value is forwarded untouched (null stays null at runtime).
      customerId: sale.customerId as ISale['customerId'],
      cashierId: sale.cashierId,
      status: sale.status,
      channel: sale.channel,
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      tax: Number(sale.tax),
      total: Number(sale.total),
      paymentStatus: sale.paymentStatus,
      currency: sale.currency,
      createdAt: sale.createdAt,
      postedAt: sale.postedAt as ISale['postedAt'],
    };
  }
}
