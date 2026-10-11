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

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
    private readonly tenantService: TenantService,
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
