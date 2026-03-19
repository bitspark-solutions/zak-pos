import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import type { CommitSaleDto, RefundSaleDto, ISale, ISaleLine } from './interfaces/sales.interface';

@Injectable()
export class SalesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
  ) {}

  async commitSale(dto: CommitSaleDto): Promise<{ sale: ISale; lines: ISaleLine[] }> {
    const { prisma } = this.databaseService.getPrisma();

    // Get cart
    const cart = await this.cartService.findByToken(dto.cartToken);

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

    return await prisma.$transaction(async (tx) => {
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
        );
      } catch (error) {
        throw new BadRequestException(`Failed to deduct inventory: ${error.message}`);
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
      await this.cartService.complete(dto.cartToken);

      return { sale: this.mapToSale(sale), lines: saleLines };
    });
  }

  private async createSaleJournalEntries(
    tx: any,
    cart: any,
    saleId: string,
    paymentMethod: string,
  ): Promise<void> {
    const tenantId = cart.tenantId;

    // Get default accounts (in production, these would be configurable)
    // For now, we'll create simple journal entries
    const cashAccount = await tx.account.findFirst({
      where: { tenantId, code: '1000' }, // Cash account
    });

    const salesRevenueAccount = await tx.account.findFirst({
      where: { tenantId, code: '4000' }, // Sales revenue
    });

    const cogsAccount = await tx.account.findFirst({
      where: { tenantId, code: '5000' }, // COGS
    });

    const inventoryAccount = await tx.account.findFirst({
      where: { tenantId, code: '1500' }, // Inventory
    });

    const vatPayableAccount = await tx.account.findFirst({
      where: { tenantId, code: '2200' }, // VAT Payable
    });

    // Create main journal entry for the sale
    const journal = await tx.journal.create({
      data: {
        tenantId,
        date: new Date(),
        description: `Sale ${saleId}`,
        source: 'SALE',
        referenceType: 'sale',
        referenceId: saleId,
        createdBy: cart.cashierId,
        status: 'posted',
        postedAt: new Date(),
      },
    });

    // Debit: Cash/Receivable
    if (cashAccount) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: cashAccount.id,
          debit: cart.total,
          credit: 0,
        },
      });
    }

    // Credit: Sales Revenue (exclusive of VAT)
    if (salesRevenueAccount) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: salesRevenueAccount.id,
          debit: 0,
          credit: cart.subtotal - cart.discount,
        },
      });
    }

    // Credit: VAT Payable
    if (vatPayableAccount && cart.tax > 0) {
      await tx.journalLine.create({
        data: {
          journalId: journal.id,
          accountId: vatPayableAccount.id,
          debit: 0,
          credit: cart.tax,
        },
      });
    }

    // Create COGS journal entry
    const cogsJournal = await tx.journal.create({
      data: {
        tenantId,
        date: new Date(),
        description: `COGS for Sale ${saleId}`,
        source: 'COGS',
        referenceType: 'sale',
        referenceId: saleId,
        createdBy: cart.cashierId,
        status: 'posted',
        postedAt: new Date(),
      },
    });

    // Estimate COGS (in production, use actual cost from inventory)
    const estimatedCogs = cart.subtotal * 0.4; // 40% cost assumption

    // Debit: COGS
    if (cogsAccount) {
      await tx.journalLine.create({
        data: {
          journalId: cogsJournal.id,
          accountId: cogsAccount.id,
          debit: estimatedCogs,
          credit: 0,
        },
      });
    }

    // Credit: Inventory
    if (inventoryAccount) {
      await tx.journalLine.create({
        data: {
          journalId: cogsJournal.id,
          accountId: inventoryAccount.id,
          debit: 0,
          credit: estimatedCogs,
        },
      });
    }
  }

  async findAll(tenantId?: string, shopId?: string): Promise<ISale[]> {
    const { prisma } = this.databaseService.getPrisma();

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (shopId) where.shopId = shopId;

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sales.map((s) => this.mapToSale(s));
  }

  async findById(id: string): Promise<ISale> {
    const { prisma } = this.databaseService.getPrisma();

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { saleLines: true },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with ID ${id} not found`);
    }

    return this.mapToSale(sale);
  }

  async findByIdWithLines(id: string): Promise<{ sale: ISale; lines: ISaleLine[] }> {
    const { prisma } = this.databaseService.getPrisma();

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { saleLines: true },
    });

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

  async refund(id: string, dto: RefundSaleDto): Promise<ISale> {
    const { prisma } = this.databaseService.getPrisma();

    const sale = await prisma.sale.findUnique({
      where: { id },
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

    // Create return record
    await prisma.return.create({
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
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        status: 'refunded',
        paymentStatus: 'refunded',
      },
    });

    return this.mapToSale(updatedSale);
  }

  private mapToSale(sale: any): ISale {
    return {
      id: sale.id,
      tenantId: sale.tenantId,
      shopId: sale.shopId,
      customerId: sale.customerId,
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
      postedAt: sale.postedAt,
    };
  }
}
