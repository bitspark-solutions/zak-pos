import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceQueryDto } from './dto/invoice.dto';
import { IInvoice, IInvoiceWithDetails, InvoiceStatus } from './interfaces/invoice.interface';

@Injectable()
export class InvoiceService {
  constructor(private readonly databaseService: DatabaseService) {}

  private generateInvoiceNumber(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}${day}-${random}`;
  }

  async create(createInvoiceDto: CreateInvoiceDto, userId: string, tenantId: string): Promise<IInvoice> {
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
          dueDate: createInvoiceDto.dueDate ? new Date(createInvoiceDto.dueDate) : null,
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

  async findAll(query: InvoiceQueryDto, tenantId: string): Promise<{ data: IInvoiceWithDetails[]; total: number; page: number; limit: number }> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const where: any = { tenantId };
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
            customer: { select: { id: true, name: true, email: true, phone: true } },
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
          sale: inv.sale ? {
            id: inv.sale.id,
            total: Number(inv.sale.total),
            status: inv.sale.status,
          } : null,
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
          customer: { select: { id: true, name: true, email: true, phone: true } },
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
        sale: invoice.sale ? {
          id: invoice.sale.id,
          total: Number(invoice.sale.total),
          status: invoice.sale.status,
        } : null,
      };
    });
  }

  async update(id: string, updateInvoiceDto: UpdateInvoiceDto, tenantId: string): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Validate status transition
      if (updateInvoiceDto.status) {
        this.validateStatusTransition(invoice.status as InvoiceStatus, updateInvoiceDto.status);
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: {
          status: updateInvoiceDto.status,
          dueDate: updateInvoiceDto.dueDate ? new Date(updateInvoiceDto.dueDate) : undefined,
          notes: updateInvoiceDto.notes,
        },
      });

      return this.mapToInterface(updated);
    });
  }

  async send(id: string, tenantId: string): Promise<IInvoice> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      if (invoice.status !== 'draft' && invoice.status !== 'confirmed') {
        throw new BadRequestException('Invoice must be in draft or confirmed status to send');
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
      const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
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
      const invoice = await prisma.invoice.findFirst({ where: { id, tenantId } });
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

  private validateStatusTransition(current: InvoiceStatus, next: InvoiceStatus): void {
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

  private mapToInterface(invoice: any): IInvoice {
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
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }
}
