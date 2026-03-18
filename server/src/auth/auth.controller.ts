import { Controller, Post, Body, UseGuards, Get, Request, Res, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Auth0Service } from './auth0.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { Response } from 'express';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private auth0Service: Auth0Service,
    private jwtService: JwtService,
    private usersService: UsersService
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req) {
    // Get full user data from database
    const user = await this.usersService.findOne(req.user.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Return user with permissions from JWT (which are role-based)
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      tenantId: user.tenantId,
      permissions: req.user.permissions || this.getUserPermissions(user.role),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Get('health')
  async getAuthHealth() {
    const auth0Config = this.auth0Service.getConfig();
    const userCount = await this.usersService.count();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      authentication: {
        local: {
          enabled: true,
          userCount: userCount,
          registration: true,
          login: true
        },
        auth0: {
          enabled: !!(auth0Config.domain && auth0Config.clientId && auth0Config.clientSecret),
          domain: auth0Config.domain || 'not configured',
          clientId: auth0Config.clientId ? 'configured' : 'not configured',
          clientSecret: auth0Config.clientSecret ? 'configured' : 'not configured',
          oauthFlow: auth0Config.domain ? true : false
        }
      },
      jwt: {
        enabled: true,
        secret: process.env.JWT_SECRET ? 'configured' : 'not configured',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      database: {
        connected: true,
        users: userCount
      }
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Request() req) {
    // Implement token refresh logic here
    return { message: 'Token refreshed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req) {
    // Implement logout logic here (token blacklisting, etc.)
    return { message: 'Logged out successfully' };
  }

  @Get('auth0/login')
  async auth0Login(@Res() res: Response) {
    // Redirect to Auth0 login page
    const loginUrl = this.auth0Service.getLoginUrl();
    res.redirect(loginUrl);
  }

  @Get('auth0/callback')
  async auth0Callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    try {
      if (!code) {
        throw new Error('Authorization code not provided');
      }

      // Exchange code for tokens
      const tokenData = await this.auth0Service.exchangeCodeForTokens(code);

      // Get user info
      const userInfo = await this.auth0Service.getUserInfo(tokenData.access_token);

      // Check if user exists in local database
      let localUser = await this.usersService.findByEmail(userInfo.email);

      if (!localUser) {
        // Create user in local database if they don't exist
        const createdUser = await this.usersService.create({
          email: userInfo.email,
          name: userInfo.name || userInfo.nickname || 'User',
          password: 'auth0-managed', // Auth0 manages the password
          role: userInfo.user_metadata?.role || 'cashier',
          tenantId: userInfo.user_metadata?.tenantId || 'tenant-1'
        });
        // create() returns user without password, findByEmail returns with password
        // Both are compatible for our use case (we don't use password field)
        localUser = createdUser as any;
      }

      if (!localUser) {
        throw new Error('Failed to get or create user');
      }

      // Generate JWT token with user context
      const payload = {
        email: localUser.email,
        sub: localUser.id,
        tenantId: localUser.tenantId,
        role: localUser.role,
        auth0Id: userInfo.sub,
        permissions: this.getUserPermissions(localUser.role)
      };

      const jwtToken = this.jwtService.sign(payload);

      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:41923'}?token=${jwtToken}`);
    } catch (error) {
      console.error('Auth0 callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:41923'}?error=auth_failed`);
    }
  }

  @Get('auth0/logout')
  async auth0Logout(@Res() res: Response) {
    const logoutUrl = this.auth0Service.getLogoutUrl();
    res.redirect(logoutUrl);
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

