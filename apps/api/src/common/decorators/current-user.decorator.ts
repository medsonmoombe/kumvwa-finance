import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { TokenClaims } from '../crypto/token.service';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TokenClaims => {
    const req = ctx.switchToHttp().getRequest<{ user: TokenClaims }>();
    return req.user;
  },
);
