import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ROLES } from './roles.decorator';
import type { TokenClaims } from '../crypto/token.service';

type AuthedRequest = Request & { user?: TokenClaims };

/** Deny by default: routes without @Roles require authentication only. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user?.role || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
