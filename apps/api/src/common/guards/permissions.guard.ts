import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { TokenClaims } from '../crypto/token.service';
import { AuditService } from '../../modules/audit/audit.service';
import { PERMISSIONS } from './permissions.decorator';

type AuthedRequest = Request & { user?: TokenClaims };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    // These two payment actions are deliberately shared with the borrower app.
    // Object-level ownership is enforced in LoansService; lender calls still
    // require the matching permission below.
    if (
      request.user?.role === 'client' &&
      required.every(
        (permission) =>
          permission === 'loans.repayment' || permission === 'loans.rollover',
      )
    ) {
      return true;
    }
    const held = request.user?.permissions ?? [];
    if (held.includes('*')) return true;

    const missing = required.filter((permission) => !held.includes(permission));
    if (missing.length === 0) return true;

    await this.audit.record({
      actorId: request.user?.sub,
      action: 'authz.denied',
      entity: 'Permission',
      tenantId: request.user?.tenantId ?? undefined,
      diff: { required: missing, path: request.url },
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    });
    throw new ForbiddenException(`Missing permission: ${missing[0]}`);
  }
}
