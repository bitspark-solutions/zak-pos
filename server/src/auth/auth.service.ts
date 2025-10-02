import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    // For Auth0 OAuth flow, validation happens in the callback
    // This method is used for direct login attempts
    const user = await this.usersService.findByEmail(email);
    if (user && user.password && await bcrypt.compare(password, user.password)) {
      const { password, ...result } = user;
      return {
        ...result,
        permissions: this.getUserPermissions(user.role)
      };
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { 
      email: user.email, 
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role 
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Step 1: Check if user already exists in local database
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Step 2: Create user in local database
    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const localUser = await this.usersService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Step 3: Generate JWT with full context
    const payload = {
      email: localUser.email,
      sub: localUser.id,
      tenantId: localUser.tenantId,
      role: localUser.role,
      permissions: this.getUserPermissions(localUser.role)
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        role: localUser.role,
        tenantId: localUser.tenantId,
        permissions: this.getUserPermissions(localUser.role)
      },
    };
  }

  async validateToken(token: string) {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private getUserPermissions(role: string): string[] {
    const rolePermissions = {
      owner: [
        'user:create', 'user:read', 'user:update', 'user:delete',
        'product:create', 'product:read', 'product:update', 'product:delete',
        'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
        'sale:create', 'sale:read', 'sale:update', 'sale:delete',
        'report:read', 'report:export',
        'system:settings:update', 'tenant:manage', 'device:manage', 'session:manage'
      ],
      manager: [
        'user:read', 'user:update',
        'product:create', 'product:read', 'product:update', 'product:delete',
        'inventory:create', 'inventory:read', 'inventory:update', 'inventory:delete',
        'sale:create', 'sale:read', 'sale:update', 'sale:delete',
        'report:read', 'report:export',
        'device:manage', 'session:manage'
      ],
      cashier: [
        'product:read',
        'inventory:read',
        'sale:create', 'sale:read',
        'report:read'
      ]
    };

    return rolePermissions[role] || [];
  }
}

