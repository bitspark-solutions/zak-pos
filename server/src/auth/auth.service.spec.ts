import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;

  const mockUser = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedPassword',
    role: 'cashier',
    tenantId: 'tenant-1',
  };

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when credentials are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 12);

      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      const result = await service.validateUser(email, password);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        tenantId: mockUser.tenantId,
      });
    });

    it('should return null when user is not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      const email = 'test@example.com';
      const wrongPassword = 'wrongpassword';
      const hashedPassword = await bcrypt.hash('correctpassword', 12);

      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      const result = await service.validateUser(email, wrongPassword);

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token and user data', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };
      const user = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'cashier',
        tenantId: 'tenant-1',
      };
      const mockToken = 'mock-jwt-token';
      const hashedPassword = await bcrypt.hash('password123', 12);

      mockUsersService.findByEmail.mockResolvedValue({
        ...user,
        password: hashedPassword,
      });
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.login(loginDto);

      expect(mockJwtService.sign).toHaveBeenCalledWith({
        email: user.email,
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });
      expect(result).toEqual({
        access_token: mockToken,
        user,
      });
    });
  });

  describe('register', () => {
    it('should create new user and return access token', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };
      const createdUser = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: 'cashier',
        tenantId: 'tenant-1',
      };
      const mockToken = 'mock-jwt-token';

      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.register(registerDto);

      expect(mockUsersService.create).toHaveBeenCalledWith({
        email: registerDto.email,
        password: expect.any(String), // hashed password
        name: registerDto.name,
      });
      expect(result).toEqual({
        access_token: mockToken,
        user: createdUser,
      });
    });

    it('should hash password before storing', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
      };
      const createdUser = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: 'cashier',
        tenantId: 'tenant-1',
      };

      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue('mock-token');

      await service.register(registerDto);

      const createCall = mockUsersService.create.mock.calls[0][0];
      expect(createCall.password).not.toBe(registerDto.password);
      expect(await bcrypt.compare(registerDto.password, createCall.password)).toBe(true);
    });
  });

  describe('validateToken', () => {
    it('should validate valid token', async () => {
      const validToken = 'valid-jwt-token';
      const decodedPayload = {
        email: 'test@example.com',
        sub: '1',
        tenantId: 'tenant-1',
        role: 'cashier',
      };

      mockJwtService.verify.mockReturnValue(decodedPayload);

      const result = await service.validateToken(validToken);

      expect(mockJwtService.verify).toHaveBeenCalledWith(validToken);
      expect(result).toEqual(decodedPayload);
    });

    it('should throw error for invalid token', async () => {
      const invalidToken = 'invalid-jwt-token';

      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.validateToken(invalidToken)).rejects.toThrow('Invalid token');
    });
  });
});
