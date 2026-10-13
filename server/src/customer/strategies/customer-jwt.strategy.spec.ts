import { UnauthorizedException } from '@nestjs/common';
import { CustomerJwtStrategy } from './customer-jwt.strategy';

describe('CustomerJwtStrategy (customer audience)', () => {
  const mockAccountRow = {
    id: 'acc-1',
    name: 'Rahim',
    phone: '+8801700000000',
    email: null,
    photoUrl: null,
    phoneVerifiedAt: new Date('2026-10-01'),
  };

  const mockPrisma = {
    customerAccount: { findUnique: jest.fn() },
  };
  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
  };

  let strategy: CustomerJwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });
    strategy = new CustomerJwtStrategy(
      mockDatabaseService as unknown as ConstructorParameters<
        typeof CustomerJwtStrategy
      >[0],
    );
  });

  it('accepts a type=customer payload and re-reads the account', async () => {
    mockPrisma.customerAccount.findUnique.mockResolvedValue(mockAccountRow);

    const user = await strategy.validate({
      sub: 'acc-1',
      type: 'customer',
      audience: 'customer',
    });

    expect(user).toEqual({
      id: 'acc-1',
      type: 'customer',
      name: 'Rahim',
      phone: '+8801700000000',
      email: null,
    });
    expect(mockPrisma.customerAccount.findUnique).toHaveBeenCalledWith({
      where: { id: 'acc-1' },
    });
  });

  it('REJECTS a staff token (no type=customer claim)', async () => {
    const staffPayload = {
      sub: 'user-1',
      email: 'cashier@zakpos.dev',
      tenantId: 'tenant-1',
      role: 'cashier',
    } as unknown as Parameters<CustomerJwtStrategy['validate']>[0];

    await expect(strategy.validate(staffPayload)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockPrisma.customerAccount.findUnique).not.toHaveBeenCalled();
  });

  it('REJECTS when the account row is gone (deleted/deactivated)', async () => {
    mockPrisma.customerAccount.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'ghost',
        type: 'customer',
        audience: 'customer',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
