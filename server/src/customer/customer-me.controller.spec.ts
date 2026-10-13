import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { CustomerMeController } from './customer-me.controller';
import { CustomerService } from './customer.service';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';

describe('CustomerMeController', () => {
  let controller: CustomerMeController;

  const mockCustomerService = {
    followBusiness: jest.fn(),
    listFollows: jest.fn(),
    unfollowBusiness: jest.fn(),
    listSharedInvoices: jest.fn(),
    getSharedInvoice: jest.fn(),
    getSharedInvoicePdf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerMeController],
      providers: [{ provide: CustomerService, useValue: mockCustomerService }],
    })
      .overrideGuard(CustomerJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CustomerMeController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('follow delegates (idempotent upsert)', async () => {
    mockCustomerService.followBusiness.mockResolvedValue({
      tenantId: 'tenant-1',
      businessName: 'ZakPOS Demo',
      source: 'qr',
      followedAt: new Date(),
    });

    const result = await controller.follow('acc-1', { tenantId: 'tenant-1' });

    expect(mockCustomerService.followBusiness).toHaveBeenCalledWith(
      'acc-1',
      'tenant-1',
    );
    expect(result.businessName).toBe('ZakPOS Demo');
  });

  it('listFollows / unfollow delegate', async () => {
    mockCustomerService.listFollows.mockResolvedValue([]);
    await controller.listFollows('acc-1');
    expect(mockCustomerService.listFollows).toHaveBeenCalledWith('acc-1');

    mockCustomerService.unfollowBusiness.mockResolvedValue(undefined);
    await controller.unfollow('acc-1', 'tenant-1');
    expect(mockCustomerService.unfollowBusiness).toHaveBeenCalledWith(
      'acc-1',
      'tenant-1',
    );
  });

  it('invoice list/detail delegate', async () => {
    mockCustomerService.listSharedInvoices.mockResolvedValue([{ id: 'inv-1' }]);
    await expect(controller.listInvoices('acc-1')).resolves.toEqual([
      { id: 'inv-1' },
    ]);

    mockCustomerService.getSharedInvoice.mockResolvedValue({ id: 'inv-1' });
    await expect(controller.invoice('acc-1', 'inv-1')).resolves.toEqual({
      id: 'inv-1',
    });
    expect(mockCustomerService.getSharedInvoice).toHaveBeenCalledWith(
      'acc-1',
      'inv-1',
    );
  });

  it('pdf route streams bytes with pdf headers', async () => {
    const buffer = Buffer.from('%PDF-1.4 invoice');
    mockCustomerService.getSharedInvoicePdf.mockResolvedValue({
      buffer,
      filename: 'INV-1.pdf',
    });
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.invoicePdf('acc-1', 'inv-1', res as unknown as Response);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'inline; filename="INV-1.pdf"',
    );
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.send).toHaveBeenCalledWith(buffer);
  });

  it('pdf route propagates access errors instead of sending bytes', async () => {
    mockCustomerService.getSharedInvoicePdf.mockRejectedValue(
      new ForbiddenException(),
    );
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await expect(
      controller.invoicePdf('acc-1', 'inv-x', res as unknown as Response),
    ).rejects.toThrow(ForbiddenException);
    expect(res.send).not.toHaveBeenCalled();
  });
});
