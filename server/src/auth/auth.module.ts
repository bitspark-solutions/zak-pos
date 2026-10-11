import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Auth0Service } from './auth0.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { DeviceService } from './device.service';
import { SessionService } from './session.service';
import { TenantService } from './tenant.service';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    UsersModule,
    DatabaseModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: (process.env.JWT_EXPIRES_IN ||
          '7d') as JwtSignOptions['expiresIn'],
      },
    }),
  ],
  providers: [
    AuthService,
    Auth0Service,
    JwtStrategy,
    LocalStrategy,
    RolesGuard,
    PermissionsGuard,
    DeviceService,
    SessionService,
    TenantService,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    RolesGuard,
    PermissionsGuard,
    SessionService,
    TenantService,
  ],
})
export class AuthModule {}
