import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { InvoiceService } from '../invoice/invoice.service';
import type { CreateCustomerDto, QueryCustomersDto } from './dto/customer.dto';
import type {
  ICustomerContact,
  ICustomerFollowSummary,
  ICustomerPortalInvoice,
  IPublicBusiness,
} from './interfaces/customer.interface';

const CONTACT_PICKER_LIMIT = 50;

@Injectable()
export class CustomerService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly invoiceService: InvoiceService,
  ) {}

  // ---------------------------------------------------------------------------
  // Staff (tenant-scoped, RLS via withTenant)
  // ---------------------------------------------------------------------------

  /**
   * List/search this tenant's POS contacts for the checkout picker.
   * Matches on name or phone (case-insensitive contains).
   */
  async findTenantCustomers(
    query: QueryCustomersDto,
    tenantId: string,
  ): Promise<ICustomerContact[]> {
    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const search = query.search?.trim();
      const where: Prisma.CustomerWhereInput = { tenantId };
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
      const customers = await prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        take: CONTACT_PICKER_LIMIT,
      });
      return customers.map((c) => this.mapContact(c));
    });
  }

  /**
   * Create a tenant contact (walk-in at checkout).
   *
   * Linking rule: when a phone is given and a global CustomerAccount with that
   * exact phone already exists, the contact row is linked to it (accountId) —
   * that link is what later lets auto-share surface the invoice in the portal.
   * We deliberately do NOT auto-create an unverified CustomerAccount here:
   * a global cross-tenant identity must only come from a customer-side auth
   * event (OTP verified / social login) that proves phone possession, not from
   * a cashier typing a possibly-mistyped number.
   */
  async createTenantCustomer(
    dto: CreateCustomerDto,
    tenantId: string,
  ): Promise<ICustomerContact> {
    const phone = dto.phone?.trim() || undefined;
    const email = dto.email?.trim() || undefined;
    const name = dto.name?.trim() || phone;
    if (!name) {
      throw new BadRequestException(
        'At least one of name or phone is required',
      );
    }

    let accountId: string | null = null;
    if (phone) {
      const account = await this.databaseService
        .getPrisma()
        .prisma.customerAccount.findUnique({
          where: { phone },
          select: { id: true },
        });
      accountId = account?.id ?? null;
    }

    return this.databaseService.withTenant(tenantId, async (prisma) => {
      const created = await prisma.customer.create({
        data: {
          tenantId,
          name,
          phone: phone ?? null,
          email: email ?? null,
          accountId,
        },
      });
      return this.mapContact(created);
    });
  }

  // ---------------------------------------------------------------------------
  // Public (no auth)
  // ---------------------------------------------------------------------------

  /**
   * Minimal pre-follow business info (QR landing screen). Cross-tenant by
   * nature, so it uses the admin client, but returns only safe fields:
   * the tenant name (there is no logo column in the schema today).
   */
  async findPublicBusiness(tenantId: string): Promise<IPublicBusiness> {
    const tenant = await this.databaseService
      .getPrisma()
      .prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
    if (!tenant) {
      throw new NotFoundException('Business not found');
    }
    return tenant;
  }

  // ---------------------------------------------------------------------------
  // Customer: follows (writes are tenant-scoped; the list is cross-tenant)
  // ---------------------------------------------------------------------------

  /**
   * Follow a business. Idempotent upsert on (accountId, tenantId): a repeat
   * scan just re-activates the row. First-touch provenance is preserved —
   * `source` is set on create ('qr' for scans) and never overwritten.
   */
  async followBusiness(
    accountId: string,
    tenantId: string,
  ): Promise<ICustomerFollowSummary> {
    const tenant = await this.databaseService
      .getPrisma()
      .prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
    if (!tenant) {
      throw new NotFoundException('Business not found');
    }

    const follow = await this.databaseService.withTenant(
      tenantId,
      async (prisma) =>
        prisma.customerFollow.upsert({
          where: { accountId_tenantId: { accountId, tenantId } },
          create: { accountId, tenantId, source: 'qr', active: true },
          update: { active: true },
        }),
    );

    return {
      tenantId,
      businessName: tenant.name,
      source: follow.source,
      followedAt: follow.createdAt,
    };
  }

  /**
   * Unfollow = deactivate (active=false), not delete: the row doubles as an
   * audit trail of when/where the customer followed, and re-following flips it
   * back. Unfollowing a tenant that is not currently followed -> 404.
   */
  async unfollowBusiness(accountId: string, tenantId: string): Promise<void> {
    const updated = await this.databaseService.withTenant(tenantId, (prisma) =>
      prisma.customerFollow.updateMany({
        where: { accountId, tenantId, active: true },
        data: { active: false },
      }),
    );
    if (updated.count === 0) {
      throw new NotFoundException('Follow not found');
    }
  }

  /**
   * Cross-tenant read of the customer's own follows -> admin client (the RLS
   * app client could only ever see one tenant at a time).
   */
  async listFollows(accountId: string): Promise<ICustomerFollowSummary[]> {
    const follows = await this.databaseService
      .getPrisma()
      .prisma.customerFollow.findMany({
        where: { accountId, active: true },
        include: { tenant: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    return follows.map((f) => ({
      tenantId: f.tenantId,
      businessName: f.tenant.name,
      source: f.source,
      followedAt: f.createdAt,
    }));
  }

  // ---------------------------------------------------------------------------
  // Customer: shared invoices portal (cross-tenant reads -> admin client)
  // ---------------------------------------------------------------------------

  /**
   * Invoices across FOLLOWED tenants that are portal-shared (sharedAt set)
   * and whose tenant contact row is linked to this account.
   */
  async listSharedInvoices(
    accountId: string,
  ): Promise<ICustomerPortalInvoice[]> {
    const { prisma } = this.databaseService.getPrisma();

    const follows = await prisma.customerFollow.findMany({
      where: { accountId, active: true },
      select: { tenantId: true },
    });
    if (follows.length === 0) {
      return [];
    }
    const followedTenantIds = follows.map((f) => f.tenantId);

    const contacts = await prisma.customer.findMany({
      where: { accountId, tenantId: { in: followedTenantIds } },
      select: { id: true },
    });
    if (contacts.length === 0) {
      return [];
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        customerId: { in: contacts.map((c) => c.id) },
        tenantId: { in: followedTenantIds },
        sharedAt: { not: null },
      },
      include: {
        tenant: { select: { name: true } },
        shop: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invoices.map((inv) => this.mapPortalInvoice(inv));
  }

  /**
   * Single shared invoice. 404 when it does not exist; 403 when it exists but
   * the caller may not see it (contact not linked to this account, invoice not
   * shared, or the tenant is not followed).
   */
  async getSharedInvoice(
    accountId: string,
    invoiceId: string,
  ): Promise<ICustomerPortalInvoice> {
    const invoice = await this.assertInvoiceAccess(accountId, invoiceId);
    return this.mapPortalInvoice(invoice);
  }

  /**
   * Customer-scoped PDF route. Staff GET /invoices/:id/pdf requires the
   * INVOICE_READ permission on a staff JWT, which a customer token can never
   * satisfy — so the portal renders through the same trusted service call
   * after the ownership checks below.
   */
  async getSharedInvoicePdf(
    accountId: string,
    invoiceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.assertInvoiceAccess(accountId, invoiceId);
    return this.invoiceService.generateInvoicePdf(invoice.id, invoice.tenantId);
  }

  private async assertInvoiceAccess(
    accountId: string,
    invoiceId: string,
  ): Promise<
    Prisma.InvoiceGetPayload<{
      include: {
        tenant: { select: { name: true } };
        shop: { select: { name: true } };
      };
    }>
  > {
    const { prisma } = this.databaseService.getPrisma();
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        tenant: { select: { name: true } },
        shop: { select: { name: true } },
      },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    const contact = invoice.customerId
      ? await prisma.customer.findUnique({
          where: { id: invoice.customerId },
          select: { accountId: true },
        })
      : null;

    const isOwner = contact?.accountId === accountId;
    if (!isOwner || !invoice.sharedAt) {
      throw new ForbiddenException('Invoice is not shared with this account');
    }

    const follow = await prisma.customerFollow.findUnique({
      where: { accountId_tenantId: { accountId, tenantId: invoice.tenantId } },
      select: { active: true },
    });
    if (!follow?.active) {
      throw new ForbiddenException('This business is not followed');
    }

    return invoice;
  }

  private mapContact(customer: {
    id: string;
    tenantId: string;
    accountId: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    createdAt: Date;
  }): ICustomerContact {
    return {
      id: customer.id,
      tenantId: customer.tenantId,
      accountId: customer.accountId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      createdAt: customer.createdAt,
    };
  }

  private mapPortalInvoice(invoice: {
    id: string;
    invoiceNumber: string;
    tenantId: string;
    status: string;
    subtotal: Prisma.Decimal;
    tax: Prisma.Decimal;
    discount: Prisma.Decimal;
    total: Prisma.Decimal;
    dueDate: Date | null;
    sharedAt: Date | null;
    createdAt: Date;
    tenant: { name: string };
    shop: { name: string };
  }): ICustomerPortalInvoice {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      tenantId: invoice.tenantId,
      businessName: invoice.tenant.name,
      shopName: invoice.shop.name,
      status: invoice.status,
      subtotal: Number(invoice.subtotal),
      tax: Number(invoice.tax),
      discount: Number(invoice.discount),
      total: Number(invoice.total),
      dueDate: invoice.dueDate,
      sharedAt: invoice.sharedAt,
      createdAt: invoice.createdAt,
    };
  }
}
