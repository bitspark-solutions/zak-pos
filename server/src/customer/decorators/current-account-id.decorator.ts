import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { CustomerAuthUser } from '../interfaces/customer.interface';

interface CustomerRequest extends Request {
  user?: CustomerAuthUser;
}

/** Extracts the authenticated CustomerAccount id from a customer JWT request. */
export const CurrentAccountId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<CustomerRequest>();
    const accountId = request.user?.id;
    if (!accountId || request.user?.type !== 'customer') {
      throw new ForbiddenException(
        'Customer account context is missing from the authentication token',
      );
    }
    return accountId;
  },
);
