import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Auth0Service } from './auth0.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { DatabaseService } from '../database/database.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type {
  AuthenticatedRequest,
  AuthUser,
} from './interfaces/auth-user.interface';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
    refreshToken: jest.fn(),
    validateToken: jest.fn(),
    changePassword: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
  };

  const mockAuth0Service = {
    getConfig: jest.fn().mockReturnValue({}),
    getLoginUrl: jest.fn(),
    getLogoutUrl: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockUsersService = {
    findOne: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: Auth0Service,
          useValue: mockAuth0Service,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: DatabaseService,
          useValue: {
            getPrisma: jest.fn().mockReturnValue({
              prisma: {
                user: { update: jest.fn().mockResolvedValue(undefined) },
              },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const mockResult = {
        access_token: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'cashier',
          tenantId: 'tenant-1',
        },
      };

      mockAuthService.login.mockResolvedValue(mockResult);

      const result = await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockResult);
    });

    it('should handle login errors', async () => {
      const loginDto: LoginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockAuthService.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(controller.login(loginDto)).rejects.toThrow(
        'Invalid credentials',
      );
    });
  });

  describe('register', () => {
    it('should create new user and return access token', async () => {
      const registerDto: RegisterDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };
      const mockResult = {
        access_token: 'mock-jwt-token',
        user: {
          id: '2',
          email: 'newuser@example.com',
          name: 'New User',
          role: 'cashier',
          tenantId: 'tenant-1',
        },
      };

      mockAuthService.register.mockResolvedValue(mockResult);

      const result = await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockResult);
    });

    it('should handle registration errors', async () => {
      const registerDto: RegisterDto = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Existing User',
      };

      mockAuthService.register.mockRejectedValue(
        new Error('User already exists'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        'User already exists',
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile from request', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockRequest = {
        user: { ...mockUser, permissions: [] },
      } as unknown as AuthenticatedRequest;

      mockUsersService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile(mockRequest);

      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.name).toBe(mockUser.name);
    });
  });

  describe('refresh', () => {
    it('should return refresh success message', () => {
      const mockRequest = {
        user: { id: '1' },
      } as unknown as AuthenticatedRequest;

      const result = controller.refresh(mockRequest);

      expect(result).toEqual({ message: 'Token refreshed successfully' });
    });
  });

  describe('logout', () => {
    it('should return success message', () => {
      const result = controller.logout();

      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });

  describe('changePassword', () => {
    it('should delegate with current user id and bearer token', async () => {
      const dto: ChangePasswordDto = {
        currentPassword: 'current-pass-1',
        newPassword: 'brand-new-1',
      };
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
        permissions: [],
      } as AuthUser;
      const mockRequest = {
        headers: { authorization: 'Bearer abc.def.ghi' },
        user: mockUser,
      } as unknown as AuthenticatedRequest;
      const mockResult = {
        message: 'Password changed successfully',
        auth0Synced: true,
      };

      mockAuthService.changePassword.mockResolvedValue(mockResult);

      const result = await controller.changePassword(
        mockUser,
        mockRequest,
        dto,
      );

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        '1',
        dto,
        'abc.def.ghi',
      );
      expect(result).toEqual(mockResult);
    });

    it('should surface wrong-current-password errors', async () => {
      const mockRequest = {
        headers: { authorization: 'Bearer token' },
        user: { id: '1' },
      } as unknown as AuthenticatedRequest;

      mockAuthService.changePassword.mockRejectedValue(
        new BadRequestException('Current password is incorrect'),
      );

      await expect(
        controller.changePassword({ id: '1' } as AuthUser, mockRequest, {
          currentPassword: 'nope',
          newPassword: 'brand-new-1',
        }),
      ).rejects.toThrow('Current password is incorrect');
    });
  });

  describe('forgotPassword', () => {
    it('should return the generic no-enumeration response', async () => {
      const dto: ForgotPasswordDto = { email: 'someone@example.com' };
      const mockResult = {
        message:
          'If an account exists for this email, a password reset code has been sent.',
      };

      mockAuthService.forgotPassword.mockResolvedValue(mockResult);

      const result = await controller.forgotPassword(dto);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('resetPassword', () => {
    it('should delegate to the service', async () => {
      const dto: ResetPasswordDto = {
        email: 'someone@example.com',
        code: '123456',
        newPassword: 'brand-new-1',
      };
      const mockResult = {
        message: 'Password reset successfully',
        auth0Synced: true,
      };

      mockAuthService.resetPassword.mockResolvedValue(mockResult);

      const result = await controller.resetPassword(dto);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockResult);
    });

    it('should reject an invalid or expired code', async () => {
      const dto: ResetPasswordDto = {
        email: 'someone@example.com',
        code: '000000',
        newPassword: 'brand-new-1',
      };

      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Invalid or expired reset code'),
      );

      await expect(controller.resetPassword(dto)).rejects.toThrow(
        'Invalid or expired reset code',
      );
    });
  });
});
