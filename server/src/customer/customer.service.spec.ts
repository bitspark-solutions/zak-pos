import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { DatabaseService } from '../database/database.service';
import { InvoiceService } from '../invoice/invoice.service';

describe('CustomerService', () => {
  let service: CustomerService;

  // Both the RLS tx client (withTenant) and the admin client (getPrisma) share
  // one stub so specs can assert exactly which model methods were called.
  const mockPrisma = {
    customer: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    customerAccount: {
      findUnique: jest.fn(),
      // Not used by CustomerService (global rows are admin-client territory),
      // but stubbed so specs can assert they are never touched.
      create: jest.fn(),
      update: jest.fn(),
    },
    customerFollow: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      // Specs assert unfollow DEACTIVATES: hard delete must never be called.
      delete: jest.fn(),
    },
    invoice: { findMany: jest.fn(), findUnique: jest.fn() },
    tenant: { findUnique: jest.fn() },
  };

  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
    withTenant: jest.fn((tenantId: string, fn: any) => fn(mockPrisma)),
  };

  const mockInvoiceService = { generateInvoicePdf: jest.fn() };

  const contactRow = {
    id: 'cust-1',
    tenantId: 'tenant-1',
    accountId: 'acc-1',
    name: 'Rahim',
    phone: '+8801700000000',
    email: null,
    createdAt: new Date('2026-10-14'),
  };

  const portalInvoiceRow = {
    id: 'inv-1',
    invoiceNumber: 'INV-20261014-0001',
    tenantId: 'tenant-1',
    customerId: 'cust-1',
    status: 'sent',
    subtotal: 100,
    tax: 15,
    discount: 0,
    total: 115,
    dueDate: null,
    sharedAt: new Date('2026-10-14'),
    createdAt: new Date('2026-10-14'),
    tenant: { name: 'ZakPOS Demo' },
    shop: { name: 'Main Store' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });
    mockDatabaseService.withTenant.mockImplementation(
      (tenantId: string, fn: any) => fn(mockPrisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: InvoiceService, useValue: mockInvoiceService },
      ],
    }).compile();

    service = module.get(CustomerService);
  });

  // -------------------------------------------------------------------------
  // Staff endpoints
  // -------------------------------------------------------------------------

  describe('findTenantCustomers (POS picker)', () => {
    it('lists tenant contacts through withTenant', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([contactRow]);

      const result = await service.findTenantCustomers({}, 'tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          take: 50,
        }),
      );
      expect(result[0].id).toBe('cust-1');
    });

    it('searches name OR phone case-insensitively', async () => {
      mockPrisma.customer.findMany.mockResolvedValue([]);

      await service.findTenantCustomers({ search: ' Rah ' }, 'tenant-1');

      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            OR: [
              { name: { contains: 'Rah', mode: 'insensitive' } },
              { phone: { contains: 'Rah', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
  });

  describe('createTenantCustomer (walk-in)', () => {
    it('links accountId when a CustomerAccount with the phone exists', async () => {
      mockPrisma.customerAccount.findUnique.mockResolvedValue({ id: 'acc-1' });
      mockPrisma.customer.create.mockResolvedValue(contactRow);

      const result = await service.createTenantCustomer(
        { phone: '+8801700000000', name: 'Rahim' },
        'tenant-1',
      );

      expect(mockPrisma.customerAccount.findUnique).toHaveBeenCalledWith({
        where: { phone: '+8801700000000' },
        select: { id: true },
      });
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'Rahim',
          accountId: 'acc-1',
        }),
      });
      expect(result.accountId).toBe('acc-1');
    });

    it('creates an unlinked contact when no account matches the phone', async () => {
      mockPrisma.customerAccount.findUnique.mockResolvedValue(null);
      mockPrisma.customer.create.mockResolvedValue({
        ...contactRow,
        accountId: null,
      });

      const result = await service.createTenantCustomer(
        { phone: '+8801799999999' },
        'tenant-1',
      );

      // No unverified global identity is minted from a cashier keystroke.
      expect(mockPrisma.customerAccount.create).not.toHaveBeenCalled();
      expect(mockPrisma.customer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '+8801799999999', // phone doubles as display name
          accountId: null,
        }),
      });
      expect(result.accountId).toBeNull();
    });

    it('rejects a payload with neither name nor phone', async () => {
      await expect(
        service.createTenantCustomer({ email: 'x@y.z' }, 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findPublicBusiness', () => {
    it('returns only safe fields for a known tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'ZakPOS Demo',
      });

      await expect(service.findPublicBusiness('tenant-1')).resolves.toEqual({
        id: 'tenant-1',
        name: 'ZakPOS Demo',
      });
    });

    it('404s for an unknown tenant', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.findPublicBusiness('nope')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Follows
  // -------------------------------------------------------------------------

  describe('followBusiness', () => {
    const followRow = {
      id: 'f-1',
      accountId: 'acc-1',
      tenantId: 'tenant-1',
      active: true,
      source: 'qr',
      createdAt: new Date('2026-10-14'),
      updatedAt: new Date('2026-10-14'),
    };

    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue({
        id: 'tenant-1',
        name: 'ZakPOS Demo',
      });
      mockPrisma.customerFollow.upsert.mockResolvedValue(followRow);
    });

    it('upserts on (accountId, tenantId) inside the target tenant scope', async () => {
      const result = await service.followBusiness('acc-1', 'tenant-1');

      expect(mockDatabaseService.withTenant).toHaveBeenCalledWith(
        'tenant-1',
        expect.any(Function),
      );
      expect(mockPrisma.customerFollow.upsert).toHaveBeenCalledWith({
        where: {
          accountId_tenantId: { accountId: 'acc-1', tenantId: 'tenant-1' },
        },
        create: {
          accountId: 'acc-1',
          tenantId: 'tenant-1',
          source: 'qr',
          active: true,
        },
        update: { active: true },
      });
      expect(result).toEqual({
        tenantId: 'tenant-1',
        businessName: 'ZakPOS Demo',
        source: 'qr',
        followedAt: followRow.createdAt,
      });
    });

    it('is idempotent: a double follow re-activates without error', async () => {
      const first = await service.followBusiness('acc-1', 'tenant-1');
      const second = await service.followBusiness('acc-1', 'tenant-1');

      expect(second).toEqual(first);
      expect(mockPrisma.customerFollow.upsert).toHaveBeenCalledTimes(2);
    });

    it('404s when the business does not exist (no tx is opened)', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.followBusiness('acc-1', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.customerFollow.upsert).not.toHaveBeenCalled();
    });
  });

  describe('unfollowBusiness (deactivate, not delete)', () => {
    it('flips active=false for the active follow only', async () => {
      mockPrisma.customerFollow.updateMany.mockResolvedValue({ count: 1 });

      await service.unfollowBusiness('acc-1', 'tenant-1');

      expect(mockPrisma.customerFollow.updateMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-1', tenantId: 'tenant-1', active: true },
        data: { active: false },
      });
      expect(mockPrisma.customerFollow.delete).not.toHaveBeenCalled();
    });

    it('404s when the tenant is not currently followed (also: double unfollow)', async () => {
      mockPrisma.customerFollow.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.unfollowBusiness('acc-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listFollows', () => {
    it('returns ACTIVE follows with business names (admin client, cross-tenant)', async () => {
      mockPrisma.customerFollow.findMany.mockResolvedValue([
        {
          tenantId: 'tenant-1',
          source: 'qr',
          createdAt: new Date('2026-10-14'),
          tenant: { id: 'tenant-1', name: 'ZakPOS Demo' },
        },
      ]);

      const result = await service.listFollows('acc-1');

      expect(mockPrisma.customerFollow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'acc-1', active: true },
        }),
      );
      expect(result).toEqual([
        {
          tenantId: 'tenant-1',
          businessName: 'ZakPOS Demo',
          source: 'qr',
          followedAt: new Date('2026-10-14'),
        },
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Portal invoices
  // -------------------------------------------------------------------------

  describe('listSharedInvoices', () => {
    it('returns ONLY followed tenants, linked contacts, shared invoices', async () => {
      mockPrisma.customerFollow.findMany.mockResolvedValue([
        { tenantId: 'tenant-1' },
      ]);
      mockPrisma.customer.findMany.mockResolvedValue([{ id: 'cust-1' }]);
      mockPrisma.invoice.findMany.mockResolvedValue([portalInvoiceRow]);

      const result = await service.listSharedInvoices('acc-1');

      // The query itself enforces all three axes server-side.
      expect(mockPrisma.customerFollow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'acc-1', active: true },
        }),
      );
      expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { accountId: 'acc-1', tenantId: { in: ['tenant-1'] } },
        }),
      );
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            customerId: { in: ['cust-1'] },
            tenantId: { in: ['tenant-1'] },
            sharedAt: { not: null },
          },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'inv-1',
        businessName: 'ZakPOS Demo',
        shopName: 'Main Store',
        total: 115,
        sharedAt: portalInvoiceRow.sharedAt,
      });
    });

    it('short-circuits to [] without an invoice query when following nothing', async () => {
      mockPrisma.customerFollow.findMany.mockResolvedValue([]);

      await expect(service.listSharedInvoices('acc-1')).resolves.toEqual([]);
      expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    });

    it('short-circuits to [] when no linked contact exists in followed tenants', async () => {
      mockPrisma.customerFollow.findMany.mockResolvedValue([
        { tenantId: 'tenant-2' },
      ]);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      await expect(service.listSharedInvoices('acc-1')).resolves.toEqual([]);
      expect(mockPrisma.invoice.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getSharedInvoice / getSharedInvoicePdf access rules', () => {
    beforeEach(() => {
      mockPrisma.customer.findUnique.mockResolvedValue({ accountId: 'acc-1' });
      mockPrisma.customerFollow.findUnique.mockResolvedValue({ active: true });
    });

    it('returns the invoice when linked + shared + tenant followed', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(portalInvoiceRow);

      const result = await service.getSharedInvoice('acc-1', 'inv-1');

      expect(result.id).toBe('inv-1');
    });

    it('404s for a nonexistent invoice id', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(service.getSharedInvoice('acc-1', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('403s when the invoice belongs to a DIFFERENT global account (cross-tenant contact)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(portalInvoiceRow);
      mockPrisma.customer.findUnique.mockResolvedValue({
        accountId: 'someone-else',
      });

      await expect(service.getSharedInvoice('acc-1', 'inv-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('403s when the invoice was never portal-shared (sharedAt null)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...portalInvoiceRow,
        sharedAt: null,
      });

      await expect(service.getSharedInvoice('acc-1', 'inv-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('403s for an invoice whose tenant is NOT followed (or unfollowed)', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(portalInvoiceRow);
      mockPrisma.customerFollow.findUnique.mockResolvedValue({ active: false });

      await expect(service.getSharedInvoice('acc-1', 'inv-1')).rejects.toThrow(
        ForbiddenException,
      );

      mockPrisma.customerFollow.findUnique.mockResolvedValue(null);
      await expect(service.getSharedInvoice('acc-1', 'inv-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('renders the PDF through InvoiceService only after access passes', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(portalInvoiceRow);
      mockInvoiceService.generateInvoicePdf.mockResolvedValue({
        buffer: Buffer.from('%PDF-1.4 fake'),
        filename: 'INV-20261014-0001.pdf',
      });

      const pdf = await service.getSharedInvoicePdf('acc-1', 'inv-1');

      expect(mockInvoiceService.generateInvoicePdf).toHaveBeenCalledWith(
        'inv-1',
        'tenant-1',
      );
      expect(pdf.filename).toBe('INV-20261014-0001.pdf');
    });

    it('never reaches the PDF renderer when access fails', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        ...portalInvoiceRow,
        sharedAt: null,
      });

      await expect(
        service.getSharedInvoicePdf('acc-1', 'inv-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(mockInvoiceService.generateInvoicePdf).not.toHaveBeenCalled();
    });
  });
});
