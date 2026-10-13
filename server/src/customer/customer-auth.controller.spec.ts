import { Test, TestingModule } from '@nestjs/testing';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtAuthGuard } from './guards/customer-jwt-auth.guard';

describe('CustomerAuthController', () => {
  let controller: CustomerAuthController;

  const mockService = {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    socialLogin: jest.fn(),
    me: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerAuthController],
      providers: [{ provide: CustomerAuthService, useValue: mockService }],
    })
      .overrideGuard(CustomerJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(CustomerAuthController);
    jest.clearAllMocks();
  });

  it('request-otp / verify-otp / social / me delegate to CustomerAuthService', async () => {
    mockService.requestOtp.mockResolvedValue({ message: 'ok' });
    await expect(
      controller.requestOtp({ phone: '+8801700000000' }),
    ).resolves.toEqual({
      message: 'ok',
    });
    expect(mockService.requestOtp).toHaveBeenCalledWith('+8801700000000');

    const loginResult = { access_token: 'jwt', account: { id: 'acc-1' } };
    mockService.verifyOtp.mockResolvedValue(loginResult);
    await expect(
      controller.verifyOtp({ phone: '+8801700000000', code: '123456' }),
    ).resolves.toBe(loginResult);
    expect(mockService.verifyOtp).toHaveBeenCalledWith(
      '+8801700000000',
      '123456',
    );

    mockService.socialLogin.mockResolvedValue(loginResult);
    await expect(
      controller.social({ accessToken: 'auth0-token' }),
    ).resolves.toBe(loginResult);
    expect(mockService.socialLogin).toHaveBeenCalledWith('auth0-token');

    mockService.me.mockResolvedValue({ id: 'acc-1' });
    await expect(controller.me('acc-1')).resolves.toEqual({ id: 'acc-1' });
    expect(mockService.me).toHaveBeenCalledWith('acc-1');
  });
});
