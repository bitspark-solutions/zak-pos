import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    getProfile: jest.fn(),
    refreshToken: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
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

      await expect(controller.login(loginDto)).rejects.toThrow('Invalid credentials');
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

      mockAuthService.register.mockRejectedValue(new Error('User already exists'));

      await expect(controller.register(registerDto)).rejects.toThrow('User already exists');
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
      };
      const mockRequest = {
        user: mockUser,
      } as Request;

      const result = await controller.getProfile(mockRequest);

      expect(result).toEqual(mockUser);
    });
  });

  describe('refresh', () => {
    it('should return refresh success message', async () => {
      const mockRequest = {
        user: { id: '1' },
      } as Request;

      const result = await controller.refresh(mockRequest);

      expect(result).toEqual({ message: 'Token refreshed successfully' });
    });
  });

  describe('logout', () => {
    it('should return success message', async () => {
      const result = await controller.logout();

      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
