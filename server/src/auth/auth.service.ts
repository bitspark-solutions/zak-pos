import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { Auth0Service, Auth0UserInfo } from './auth0.service';
import { DatabaseService } from '../database/database.service';
import { TenantService } from './tenant.service';
import { ROLE_PERMISSIONS, Role } from './enums/permissions.enum';
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
  externalId?: string | null;
  status?: string;
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private auth0Service: Auth0Service,
    private databaseService: DatabaseService,
    private tenantService: TenantService,
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
      // Credentials verified by Auth0. The local DB is the source of truth for
      // tenant/role/status - both must agree before login succeeds.
      const userInfo = auth0Result.userInfo;
      const userEmail = userInfo.email;
      let localUser = (await this.usersService.findByEmail(
        userEmail,
      )) as UserWithPassword | null;

      if (!localUser) {
        // Self-service Auth0 accounts are not provisioned here; deny until an
        // owner/admin registers the user (register flow writes both stores).
        this.logger.warn(
          `Auth0 user ${userEmail} has no local DB record - rejecting login`,
        );
        return null;
      }

      if (localUser.status && localUser.status !== 'active') {
        throw new UnauthorizedException('User account is disabled');
      }

      // Backfill Auth0 user_id mapping if register/codes created the row first
      if (!localUser.externalId && userInfo.sub) {
        await this.databaseService
          .getPrisma()
          .prisma.user.update({
            where: { id: localUser.id },
            data: { externalId: userInfo.sub },
          })
          .catch((err: unknown) =>
            this.logger.warn(
              `Failed to backfill externalId for ${localUser.id}: ${String(err)}`,
            ),
          );
        localUser.externalId = userInfo.sub;
      }

      return {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        tenantId: localUser.tenantId,
        auth0Id: localUser.externalId || userInfo.sub,
        permissions: this.getUserPermissions(localUser.role),
      };
    }

    // Fallback to PostgreSQL authentication (for local-only users registered
    // before Auth0, or when Auth0 is unavailable)
    const user = (await this.usersService.findByEmail(
      email,
    )) as UserWithPassword | null;
    if (
      user &&
      user.password &&
      user.password !== 'auth0-managed' &&
      (await bcrypt.compare(password, user.password))
    ) {
      if (user.status && user.status !== 'active') {
        throw new UnauthorizedException('User account is disabled');
      }
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        auth0Id: user.externalId || undefined,
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

    // Step 3: Resolve the tenant (real provisioning, no fallback IDs).
    // Owner self-registration creates tenant + first shop + chart of accounts;
    // staff joining an existing tenant is validated against the DB.
    if (registerDto.tenantId && registerDto.role === 'owner') {
      throw new BadRequestException(
        'Owners provision their own store; remove tenantId to create a new one',
      );
    }

    let tenantId: string;
    let shopId: string | undefined;
    if (!registerDto.tenantId) {
      const store = await this.tenantService.provisionStore(
        registerDto.name,
        registerDto.storeName,
      );
      tenantId = store.tenantId;
      shopId = store.shopId;
    } else {
      try {
        const ensured = await this.tenantService.ensureTenant(
          registerDto.tenantId,
        );
        tenantId = ensured.tenantId;
        shopId = ensured.shopId;
      } catch {
        throw new BadRequestException(
          `Unknown tenant ${registerDto.tenantId} - ask the owner for a valid workspace ID`,
        );
      }
    }

    // Step 4: Create user in Auth0 (credential authority), then mirror into
    // the local DB with the Auth0 user_id as externalId
    let auth0UserId: string | null = null;
    try {
      const auth0User = await this.auth0Service.createUser({
        email: registerDto.email,
        password: registerDto.password,
        name: registerDto.name,
        role: userRole,
        tenantId,
      });
      auth0UserId = auth0User.auth0Id;
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
        errorMessage.includes('Management API') ||
        errorMessage.includes('not configured')
      ) {
        this.logger.warn(
          'Auth0 Management API not available, falling back to local-only registration',
        );
      } else {
        // For other errors, still throw
        throw new BadRequestException(`Failed to create user: ${errorMessage}`);
      }
    }

    // Step 5: Create user in local database (source of truth for tenant/role/status)
    // Password is mirrored as a bcrypt hash so API login works even when Auth0
    // rejects the direct grant (ROPG is disabled on new tenants).
    const passwordToStore = await bcrypt.hash(registerDto.password, 10);

    const localUser = (await this.usersService.create({
      email: registerDto.email,
      name: registerDto.name,
      password: passwordToStore,
      role: userRole,
      phone: registerDto.phone,
      externalId: auth0UserId || undefined,
    }, tenantId)) as UserWithPassword;

    // Step 6: Generate JWT with full context
    const permissions = this.getUserPermissions(localUser.role);
    const payload = {
      email: localUser.email,
      sub: localUser.id,
      tenantId: localUser.tenantId,
      shopId,
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
        shopId,
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
    return ROLE_PERMISSIONS[role as Role] || [];
  }
}
