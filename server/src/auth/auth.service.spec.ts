import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Auth0Service } from './auth0.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let auth0Service: Auth0Service;

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

  const mockAuth0Service = {
    validateUser: jest.fn(),
    createUser: jest.fn(),
    getUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUsersByTenant: jest.fn(),
    assignRoleToUser: jest.fn(),
    createRole: jest.fn(),
    getRoles: jest.fn(),
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
        {
          provide: Auth0Service,
          useValue: mockAuth0Service,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    auth0Service = module.get<Auth0Service>(Auth0Service);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user data when Auth0 and local user are valid', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const auth0User = {
        auth0Id: 'auth0|123456789',
        email: email,
        name: 'Test User',
        accessToken: 'auth0-access-token',
        idToken: 'auth0-id-token'
      };

      mockAuth0Service.validateUser.mockResolvedValue(auth0User);
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.validateUser(email, password);

      expect(mockAuth0Service.validateUser).toHaveBeenCalledWith(email, password);
      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(email);
      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
        role: mockUser.role,
        tenantId: mockUser.tenantId,
        auth0Id: auth0User.auth0Id,
        permissions: expect.any(Array)
      });
    });

    it('should return null when Auth0 validation fails', async () => {
      mockAuth0Service.validateUser.mockResolvedValue(null);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(mockAuth0Service.validateUser).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });

    it('should throw error when user not found in local database', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      const auth0User = {
        auth0Id: 'auth0|123456789',
        email: email,
        name: 'Test User',
        accessToken: 'auth0-access-token',
        idToken: 'auth0-id-token'
      };

      mockAuth0Service.validateUser.mockResolvedValue(auth0User);
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(service.validateUser(email, password)).rejects.toThrow('User not found in local database');
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
      const auth0User = {
        auth0Id: 'auth0|123456789',
        email: loginDto.email,
        name: 'Test User',
        accessToken: 'auth0-access-token',
        idToken: 'auth0-id-token'
      };
      const mockToken = 'mock-jwt-token';

      mockAuth0Service.validateUser.mockResolvedValue(auth0User);
      mockUsersService.findByEmail.mockResolvedValue(user);
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
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        },
      });
    });
  });

  describe('register', () => {
    it('should create new user in Auth0 and local database, return access token', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'cashier',
        tenantId: 'tenant-1'
      };
      const createdUser = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
      };
      const auth0User = {
        user_id: 'auth0|123456789',
        email: registerDto.email,
        name: registerDto.name
      };
      const mockToken = 'mock-jwt-token';

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockAuth0Service.createUser.mockResolvedValue(auth0User);
      mockUsersService.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await service.register(registerDto);

      expect(mockUsersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(mockAuth0Service.createUser).toHaveBeenCalledWith({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId
      });
      expect(mockUsersService.create).toHaveBeenCalledWith({
        ...registerDto,
        password: expect.any(String), // hashed password
      });
      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          role: createdUser.role,
          tenantId: createdUser.tenantId,
          auth0Id: auth0User.user_id,
          permissions: expect.any(Array)
        },
      });
    });

    it('should hash password before storing', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        role: 'cashier',
        tenantId: 'tenant-1'
      };
      const createdUser = {
        id: '2',
        email: registerDto.email,
        name: registerDto.name,
        role: registerDto.role,
        tenantId: registerDto.tenantId,
      };
      const auth0User = {
        user_id: 'auth0|123456789',
        email: registerDto.email,
        name: registerDto.name
      };

      mockUsersService.findByEmail.mockResolvedValue(null);
      mockAuth0Service.createUser.mockResolvedValue(auth0User);
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
