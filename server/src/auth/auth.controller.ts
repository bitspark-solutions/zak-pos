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
    // Redirect to Auth0 login - the express-openid-connect middleware handles /login
    res.redirect('/login');
  }

  @Get('auth0/logout')
  async auth0Logout(@Res() res: Response) {
    // Redirect to Auth0 logout - the express-openid-connect middleware handles /logout
    res.redirect('/logout');
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

