import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const userId = request.user?.id;
    if (!userId) {
      throw new ForbiddenException('User context is missing from the authentication token');
    }
    return userId;
  },
);
