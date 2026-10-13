import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController, BusinessController } from './customer.controller';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';

describe('CustomerController (staff) + BusinessController (public)', () => {
  let controller: CustomerController;
  let businessController: BusinessController;

  const mockCustomerService = {
    findTenantCustomers: jest.fn(),
    createTenantCustomer: jest.fn(),
    findPublicBusiness: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController, BusinessController],
      providers: [{ provide: CustomerService, useValue: mockCustomerService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CustomerController);
    businessController = module.get(BusinessController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(businessController).toBeDefined();
  });

  describe('GET /customers', () => {
    it('delegates the query + tenant scope', async () => {
      mockCustomerService.findTenantCustomers.mockResolvedValue([]);

      const result = await controller.findMany({ search: 'rah' }, 'tenant-1');

      expect(result).toEqual([]);
      expect(mockCustomerService.findTenantCustomers).toHaveBeenCalledWith(
        { search: 'rah' },
        'tenant-1',
      );
    });
  });

  describe('POST /customers', () => {
    it('delegates the walk-in payload + tenant scope', async () => {
      const contact = {
        id: 'cust-1',
        tenantId: 'tenant-1',
        accountId: null,
        name: 'Walk-in',
        phone: null,
        email: null,
        createdAt: new Date(),
      };
      mockCustomerService.createTenantCustomer.mockResolvedValue(contact);

      const result = await controller.create({ name: 'Walk-in' }, 'tenant-1');

      expect(result).toEqual(contact);
      expect(mockCustomerService.createTenantCustomer).toHaveBeenCalledWith(
        { name: 'Walk-in' },
        'tenant-1',
      );
    });
  });

  describe('GET /businesses/:tenantId (public)', () => {
    it('delegates and returns the safe projection', async () => {
      mockCustomerService.findPublicBusiness.mockResolvedValue({
        id: 'tenant-1',
        name: 'ZakPOS Demo',
      });

      await expect(businessController.findOne('tenant-1')).resolves.toEqual({
        id: 'tenant-1',
        name: 'ZakPOS Demo',
      });
      expect(mockCustomerService.findPublicBusiness).toHaveBeenCalledWith(
        'tenant-1',
      );
    });
  });
});
