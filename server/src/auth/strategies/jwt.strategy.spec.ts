import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import type { TokenPayload } from '../interfaces/auth-user.interface';

describe('JwtStrategy (staff audience)', () => {
  const mockUserRow = {
    id: 'user-1',
    email: 'cashier@zakpos.dev',
    name: 'Cashier',
    tenantId: 'tenant-1',
    role: 'cashier',
    status: 'active',
  };

  const mockPrisma = {
    user: { findUnique: jest.fn() },
  };
  const mockDatabaseService = {
    getPrisma: jest.fn().mockReturnValue({ prisma: mockPrisma }),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getPrisma.mockReturnValue({ prisma: mockPrisma });
    strategy = new JwtStrategy(
      mockDatabaseService as unknown as ConstructorParameters<
        typeof JwtStrategy
      >[0],
    );
  });

  const staffPayload: TokenPayload = {
    sub: 'user-1',
    email: 'cashier@zakpos.dev',
    tenantId: 'tenant-1',
    role: 'cashier',
  };

  it('accepts a normal staff payload and re-reads the DB', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockUserRow);

    const user = await strategy.validate(staffPayload);

    expect(user).toMatchObject({
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'cashier',
    });
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
    });
  });

  it('REJECTS a customer token (type=customer) even though the secret is shared', async () => {
    // A customer JWT signed with the same JWT_SECRET must never authenticate
    // staff routes.
    const customerPayload = {
      sub: 'acc-1',
      type: 'customer',
      audience: 'customer',
    } as unknown as TokenPayload;

    await expect(strategy.validate(customerPayload)).rejects.toThrow(
      UnauthorizedException,
    );
    // The rejection happens before any DB touch.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
