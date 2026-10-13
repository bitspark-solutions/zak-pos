import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Prisma, Invoice } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { ReceiptPdfService } from '../pdf/receipt-pdf.service';
import type { ReceiptPdfPayload } from '../pdf/interfaces/receipt-pdf.interface';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceQueryDto,
} from './dto/invoice.dto';
import {
  IInvoice,
  IInvoiceWithDetails,
  InvoiceStatus,
} from './interfaces/invoice.interface';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly receiptPdf: ReceiptPdfService,
  ) {}

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `INV-${year}${month}${day}-${random}`;
  }

  async create(
    createInvoiceDto: CreateInvoiceDto,
    userId: string,
    tenantId: string,
  ): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      // If saleId provided, get sale data
      let subtotal = 0;
      let tax = 0;
      let discount = 0;
      let total = 0;

      if (createInvoiceDto.saleId) {
        const sale = await prisma.sale.findFirst({
          where: { id: createInvoiceDto.saleId, tenantId },
        });
        if (!sale) {
          throw new NotFoundException('Sale not found');
        }
        subtotal = Number(sale.subtotal);
        tax = Number(sale.tax);
        discount = Number(sale.discount);
        total = Number(sale.total);
      }

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: this.generateInvoiceNumber(),
          tenantId,
          shopId: createInvoiceDto.shopId,
          saleId: createInvoiceDto.saleId,
          customerId: createInvoiceDto.customerId,
          dueDate: createInvoiceDto.dueDate
            ? new Date(createInvoiceDto.dueDate)
            : null,
          notes: createInvoiceDto.notes,
          subtotal,
          tax,
          discount,
          total,
          status: 'draft',
        },
      });

      return this.mapToInterface(invoice);
    });
  }

  /**
   * Create (or return the already-created) invoice for a completed sale.
   *
   * Idempotent: `Invoice.saleId` is unique, so when an invoice already
   * references the sale we hand back the existing one instead of duplicating.
   * Runs entirely inside one RLS-scoped tenant transaction. `userId` is kept in
   * the signature for parity with {@link create}; the Invoice row has no
   * createdBy column, so it is intentionally not persisted.
   */
  async createFromSale(
    saleId: string,
    userId: string,
    tenantId: string,
  ): Promise<{ invoice: IInvoice; created: boolean }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const existing = await prisma.invoice.findFirst({
        where: { saleId, tenantId },
      });
      if (existing) {
        return { invoice: this.mapToInterface(existing), created: false };
      }

      const sale = await prisma.sale.findFirst({
        where: { id: saleId, tenantId },
      });
      if (!sale) {
        throw new NotFoundException('Sale not found');
      }

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: this.generateInvoiceNumber(),
          tenantId,
          shopId: sale.shopId,
          saleId: sale.id,
          customerId: sale.customerId,
          subtotal: sale.subtotal,
          tax: sale.tax,
          discount: sale.discount,
          total: sale.total,
          status: 'draft',
        },
      });

      // G2a auto-share: best-effort, inside this same tenant transaction.
      const sharedAt = await this.autoShareInvoice(
        prisma,
        invoice.id,
        sale.customerId,
        tenantId,
      );
      const finalInvoice = sharedAt ? { ...invoice, sharedAt } : invoice;

      return { invoice: this.mapToInterface(finalInvoice), created: true };
    });
  }

  /**
   * Auto-share (G2a customer portal), runs inside the caller's tenant-scoped
   * transaction right after the invoice row is created.
   *
   * Sets `Invoice.sharedAt` only when ALL hold: the sale had a tenant contact
   * (customerId), that contact is linked to a global CustomerAccount
   * (customers.accountId), the account verified its phone
   * (phoneVerifiedAt != null), and an ACTIVE CustomerFollow exists for
   * (accountId, tenantId). `customerId` itself is left untouched — it remains
   * the tenant-scoped contact, so the G1a from-sale contract is unchanged.
   *
   * Deliberately never throws out into the sale/invoice flow: any miss simply
   * skips sharing (returns null).
   */
  private async autoShareInvoice(
    prisma: Prisma.TransactionClient,
    invoiceId: string,
    customerId: string | null,
    tenantId: string,
  ): Promise<Date | null> {
    if (!customerId) {
      return null;
    }
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId },
        select: { accountId: true },
      });
      if (!customer?.accountId) {
        return null;
      }

      const account = await prisma.customerAccount.findUnique({
        where: { id: customer.accountId },
        select: { phoneVerifiedAt: true },
      });
      if (!account?.phoneVerifiedAt) {
        return null;
      }

      const follow = await prisma.customerFollow.findUnique({
        where: {
          accountId_tenantId: { accountId: customer.accountId, tenantId },
        },
        select: { active: true },
      });
      if (!follow?.active) {
        return null;
      }

      const sharedAt = new Date();
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { sharedAt },
      });
      return sharedAt;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Invoice auto-share skipped for ${invoiceId}: ${message}`,
      );
      return null;
    }
  }

  /**
   * Render a tenant-scoped invoice as a thermal-slip PDF. The invoice itself
   * only stores totals (there is no invoice-line model), so the line items and
   * payment method are pulled from the linked sale when one exists.
   */
  async generateInvoicePdf(
    id: string,
    tenantId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: {
          shop: { select: { name: true, address: true } },
          customer: { select: { name: true, phone: true } },
          sale: {
            select: {
              currency: true,
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
          },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      const payload = this.buildInvoicePdfPayload(invoice);
      const buffer = await this.receiptPdf.render(payload);
      return { buffer, filename: `${invoice.invoiceNumber}.pdf` };
    });
  }

  /**
   * Map a fully-included invoice row into the normalized receipt payload. The
   * argument keeps its Prisma-inferred shape so field access stays type-safe
   * here rather than being cast through a hand-written record type.
   */
  private buildInvoicePdfPayload(invoice: {
    invoiceNumber: string;
    status: string;
    createdAt: Date;
    subtotal: Prisma.Decimal;
    tax: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
    notes: string | null;
    shop: { name: string; address: string | null };
    customer: { name: string; phone: string | null } | null;
    sale: {
      currency: string;
      saleLines: Array<{
        qty: Prisma.Decimal;
        unitPrice: Prisma.Decimal;
        lineTotal: Prisma.Decimal;
        product: { name: string };
      }>;
      payments: Array<{ method: string }>;
    } | null;
  }): ReceiptPdfPayload {
    return {
      shopName: invoice.shop.name,
      shopAddress: invoice.shop.address,
      documentNumber: invoice.invoiceNumber,
      documentTitle: 'TAX INVOICE',
      date: invoice.createdAt,
      customerName: invoice.customer?.name ?? null,
      customerPhone: invoice.customer?.phone ?? null,
      lines: (invoice.sale?.saleLines ?? []).map((line) => ({
        name: line.product.name,
        qty: Number(line.qty),
        unitPrice: Number(line.unitPrice),
        amount: Number(line.lineTotal),
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      tax: Number(invoice.tax),
      total: Number(invoice.total),
      paymentMethod: invoice.sale?.payments[0]?.method ?? null,
      currency: invoice.sale?.currency ?? 'BDT',
      notes: invoice.notes,
    };
  }

  async findAll(
    query: InvoiceQueryDto,
    tenantId: string,
  ): Promise<{
    data: IInvoiceWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const where: Prisma.InvoiceWhereInput = { tenantId };
      if (query.shopId) where.shopId = query.shopId;
      if (query.customerId) where.customerId = query.customerId;
      if (query.status) where.status = query.status;

      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
          where,
          include: {
            shop: { select: { id: true, name: true } },
            customer: {
              select: { id: true, name: true, email: true, phone: true },
            },
            sale: { select: { id: true, total: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.invoice.count({ where }),
      ]);

      return {
        data: invoices.map((inv) => ({
          ...this.mapToInterface(inv),
          shop: inv.shop,
          customer: inv.customer,
          sale: inv.sale
            ? {
                id: inv.sale.id,
                total: Number(inv.sale.total),
                status: inv.sale.status,
              }
            : null,
        })),
        total,
        page,
        limit,
      };
    });
  }

  async findOne(id: string, tenantId: string): Promise<IInvoiceWithDetails> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: {
          shop: { select: { id: true, name: true } },
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          sale: { select: { id: true, total: true, status: true } },
        },
      });

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      return {
        ...this.mapToInterface(invoice),
        shop: invoice.shop,
        customer: invoice.customer,
        sale: invoice.sale
          ? {
              id: invoice.sale.id,
              total: Number(invoice.sale.total),
              status: invoice.sale.status,
            }
          : null,
      };
    });
  }

  async update(
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
    tenantId: string,
  ): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Validate status transition
      if (updateInvoiceDto.status) {
        this.validateStatusTransition(
          invoice.status as InvoiceStatus,
          updateInvoiceDto.status,
        );
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: {
          status: updateInvoiceDto.status,
          dueDate: updateInvoiceDto.dueDate
            ? new Date(updateInvoiceDto.dueDate)
            : undefined,
          notes: updateInvoiceDto.notes,
        },
      });

      return this.mapToInterface(updated);
    });
  }

  async send(id: string, tenantId: string): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== 'draft' && invoice.status !== 'confirmed') {
        throw new BadRequestException(
          'Invoice must be in draft or confirmed status to send',
        );
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: 'sent' },
      });

      // TODO: Send email/SMS notification to customer
      // await this.notificationService.sendInvoice(invoice);

      return this.mapToInterface(updated);
    });
  }

  async confirm(id: string, tenantId: string): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== 'sent') {
        throw new BadRequestException('Invoice must be sent to confirm');
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: 'confirmed' },
      });

      return this.mapToInterface(updated);
    });
  }

  async cancel(id: string, tenantId: string): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status === 'paid') {
        throw new BadRequestException('Cannot cancel a paid invoice');
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      return this.mapToInterface(updated);
    });
  }

  private validateStatusTransition(
    current: InvoiceStatus,
    next: InvoiceStatus,
  ): void {
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      draft: ['sent', 'cancelled'],
      sent: ['confirmed', 'cancelled'],
      confirmed: ['paid', 'cancelled'],
      paid: [], // Cannot transition from paid
      cancelled: [], // Cannot transition from cancelled
    };

    if (!validTransitions[current].includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }
  }

  private mapToInterface(invoice: Invoice): IInvoice {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId,
      shopId: invoice.shopId,
      saleId: invoice.saleId,
      customerId: invoice.customerId,
      status: invoice.status as InvoiceStatus,
      dueDate: invoice.dueDate,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      notes: invoice.notes,
      sharedAt: invoice.sharedAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
