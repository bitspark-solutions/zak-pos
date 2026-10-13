import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guards customer-only routes; resolves CustomerJwtStrategy ('customer-jwt'). */
@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('customer-jwt') {}
