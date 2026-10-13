import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type {
  CustomerAuthUser,
  CustomerTokenPayload,
} from '../interfaces/customer.interface';

/**
 * Customer audience strategy — registered under the name 'customer-jwt'.
 *
 * Shares JWT_SECRET with the staff strategy but the two audiences are NOT
 * interchangeable: this strategy REJECTS any token without type='customer'
 * (staff tokens), and JwtStrategy rejects type='customer' tokens. Like the
 * staff strategy, the signature is necessary but not sufficient — the account
 * row is re-read through the admin client (CustomerAccount is global and has
 * no tenantId, so it is intentionally outside RLS).
 */
@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(
  Strategy,
  'customer-jwt',
) {
  constructor(private databaseService: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: CustomerTokenPayload): Promise<CustomerAuthUser> {
    if (payload.type !== 'customer') {
      throw new UnauthorizedException(
        'Not a customer token - use the staff login for this API',
      );
    }

    const account = await this.databaseService
      .getPrisma()
      .prisma.customerAccount.findUnique({ where: { id: payload.sub } });

    if (!account) {
      throw new UnauthorizedException('Customer account no longer exists');
    }

    return {
      id: account.id,
      type: 'customer',
      name: account.name,
      phone: account.phone,
      email: account.email,
    };
  }
}
