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
  getProfile(@Request() req) {
    return req.user;
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
      const localUser = await this.usersService.findByEmail(userInfo.email);

      if (!localUser) {
        // Create user in local database if they don't exist
        const newUser = await this.usersService.create({
          email: userInfo.email,
          name: userInfo.name,
          password: 'auth0-managed', // Auth0 manages the password
          role: userInfo.user_metadata?.role || 'cashier',
          tenantId: userInfo.user_metadata?.tenantId || 'tenant-1'
        });

        // Generate JWT token with user context
        const payload = {
          email: newUser.email,
          sub: newUser.id,
          tenantId: newUser.tenantId,
          role: newUser.role,
          auth0Id: userInfo.sub,
          permissions: this.getUserPermissions(newUser.role)
        };

        const jwtToken = this.jwtService.sign(payload);

        // Redirect to frontend with token
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}?token=${jwtToken}`);
      } else {
        // User exists, generate JWT with existing data
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
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}?token=${jwtToken}`);
      }
    } catch (error) {
      console.error('Auth0 callback error:', error);
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}?error=auth_failed`);
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

