import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ROLE_PERMISSIONS, Role } from '../enums/permissions.enum';
import type { AuthUser, TokenPayload } from '../interfaces/auth-user.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private databaseService: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: TokenPayload): Promise<AuthUser> {
    // Token signature is necessary but not sufficient: the local DB is the
    // source of truth, so every request re-reads tenant/role/status.
    const user = await this.databaseService
      .getPrisma()
      .prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is disabled');
    }

    // Permissions come from the current DB role, not the token snapshot
    const permissions =
      ROLE_PERMISSIONS[user.role as Role] || payload.permissions || [];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      role: user.role,
      permissions,
    };
  }
}
