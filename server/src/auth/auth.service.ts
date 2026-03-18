import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { Auth0Service, Auth0UserInfo } from './auth0.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

interface Auth0Result {
  userInfo: Auth0UserInfo;
}

interface UserWithPassword {
  id: string;
  email: string;
  name: string;
  password?: string | null;
  role: string;
  tenantId: string;
  phone?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  permissions: string[];
  auth0Id?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private auth0Service: Auth0Service,
  ) {}

  private isAuth0Result(result: unknown): result is Auth0Result {
    return (
      typeof result === 'object' &&
      result !== null &&
      'userInfo' in result &&
      typeof (result as { userInfo: unknown }).userInfo === 'object' &&
      (result as { userInfo: { email?: unknown } }).userInfo !== null &&
      typeof (result as { userInfo: { email: unknown } }).userInfo.email ===
        'string'
    );
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    // Try Auth0 authentication first (if configured)
    let auth0Result: Auth0Result | null = null;
    try {
      // Type assertion needed because validateUser returns Promise<Auth0ValidationResult | null>
      // but we check with type guard to ensure type safety
      const result = (await this.auth0Service.validateUser(
        email,
        password,
      )) as Auth0Result | null;
      if (result && this.isAuth0Result(result)) {
        auth0Result = result;
      }
    } catch (error: unknown) {
      // If Auth0 fails for any reason, log and fall back to PostgreSQL
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        'Auth0 validation error, falling back to PostgreSQL:',
        errorMessage,
      );
      auth0Result = null;
    }

    if (auth0Result && auth0Result.userInfo) {
      // User authenticated via Auth0, validate/ensure user exists in PostgreSQL
      // Type is guaranteed by type guard above - using eslint-disable for linter false positives
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const userInfo = auth0Result.userInfo as Auth0UserInfo;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const userEmail = userInfo.email;
      let localUser = (await this.usersService.findByEmail(
        userEmail as string,
      )) as UserWithPassword | null;

      if (!localUser) {
        // Create local user record if doesn't exist
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const userName = userInfo.name || userInfo.nickname || 'User';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const userRole = userInfo.user_metadata?.role || 'cashier';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const userTenantId = userInfo.user_metadata?.tenantId || 'tenant-1';
        const createdUser = (await this.usersService.create({
          email: userEmail as string,
          name: userName as string,
          password: 'auth0-managed', // Auth0 manages password
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          role: userRole,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          tenantId: userTenantId,
        })) as UserWithPassword;
        localUser = createdUser;
      }

      if (!localUser) {
        throw new Error('Failed to get or create user in PostgreSQL');
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const auth0Id = userInfo.sub;
      return {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        tenantId: localUser.tenantId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        auth0Id: auth0Id,
        permissions: this.getUserPermissions(localUser.role),
      };
    }

    // Fallback to PostgreSQL authentication (for users not in Auth0 or Auth0 unavailable)
    const user = (await this.usersService.findByEmail(
      email,
    )) as UserWithPassword | null;
    if (
      user &&
      user.password &&
      user.password !== 'auth0-managed' &&
      (await bcrypt.compare(password, user.password))
    ) {
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        permissions: this.getUserPermissions(user.role),
      };
    }

    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      permissions: user.permissions || this.getUserPermissions(user.role),
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        permissions: user.permissions || this.getUserPermissions(user.role),
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Step 1: Validate input
    if (!registerDto.email || !registerDto.password || !registerDto.name) {
      throw new BadRequestException('Email, password, and name are required');
    }

    // Step 2: Check if user already exists in local database
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Determine default role:
    // - If tenantId is provided (invited registration), use provided role or default to 'cashier'
    // - If no tenantId (public registration), default to 'owner' (business owner registration)
    const defaultRole = registerDto.tenantId ? 'cashier' : 'owner';
    const userRole = registerDto.role || defaultRole;

    // Step 3: Try to create user in Auth0 first (optional - falls back to local if Auth0 unavailable)
    let useAuth0Password = false;
    try {
      await this.auth0Service.createUser({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        role: userRole,
        tenantId: registerDto.tenantId || 'tenant-1',
      });
      useAuth0Password = true; // Auth0 manages the password
    } catch (error: unknown) {
      // If Auth0 creation fails, check if it's a user conflict
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      if (
        errorMessage.includes('already exists') ||
        errorMessage.includes('User already exists')
      ) {
        throw new ConflictException('User with this email already exists');
      }
      // If Auth0 Management API is not enabled or unavailable, fall back to local-only registration
      if (
        errorMessage.includes('Service not enabled') ||
        errorMessage.includes('access_denied') ||
        errorMessage.includes('Management API')
      ) {
        console.warn(
          'Auth0 Management API not available, falling back to local-only registration',
        );
        useAuth0Password = false; // Store password locally
      } else {
        // For other errors, still throw
        throw new BadRequestException(`Failed to create user: ${errorMessage}`);
      }
    }

    // Step 4: Create user in local database
    // Hash password if storing locally (not managed by Auth0)
    const passwordToStore = useAuth0Password
      ? 'auth0-managed'
      : await bcrypt.hash(registerDto.password, 10); // Hash password for local storage

    const localUser = (await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: passwordToStore,
      role: userRole,
      tenantId: registerDto.tenantId || 'tenant-1',
      phone: registerDto.phone,
    })) as UserWithPassword;

    // Step 5: Generate JWT with full context
    const permissions = this.getUserPermissions(localUser.role);
    const payload = {
      email: localUser.email,
      sub: localUser.id,
      tenantId: localUser.tenantId,
      role: localUser.role,
      permissions: permissions,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        tenantId: localUser.tenantId,
        permissions: permissions,
      },
    };
  }

  async validateToken(token: string): Promise<unknown> {
    try {
      return await Promise.resolve(this.jwtService.verify(token));
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getUserPermissions(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      owner: [
        'user:create',
        'user:read',
        'user:update',
        'user:delete',
        'product:create',
        'product:read',
        'product:update',
        'product:delete',
        'inventory:create',
        'inventory:read',
        'inventory:update',
        'inventory:delete',
        'sale:create',
        'sale:read',
        'sale:update',
        'sale:delete',
        'report:read',
        'report:export',
        'system:settings:update',
        'tenant:manage',
        'device:manage',
        'session:manage',
      ],
      manager: [
        'user:read',
        'user:update',
        'product:create',
        'product:read',
        'product:update',
        'product:delete',
        'inventory:create',
        'inventory:read',
        'inventory:update',
        'inventory:delete',
        'sale:create',
        'sale:read',
        'sale:update',
        'sale:delete',
        'report:read',
        'report:export',
        'device:manage',
        'session:manage',
      ],
      cashier: [
        'product:read',
        'inventory:read',
        'sale:create',
        'sale:read',
        'report:read',
      ],
    };

    return rolePermissions[role] || [];
  }
}
