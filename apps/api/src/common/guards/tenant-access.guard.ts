import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { TokenClaims } from '../crypto/token.service';
import { PrismaService } from '../../infra/prisma.module';
import { ALLOW_UNVERIFIED_TENANT } from './unverified-tenant.decorator';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_TENANT,
      [context.getHandler(), context.getClass()],
    );
    if (allowed) return true;

    const request = context.switchToHttp().getRequest<{ user?: TokenClaims }>();
    const user = request.user;
    if (
      !user?.tenantId ||
      (user.role !== 'tenant_owner' && user.role !== 'tenant_staff')
    ) {
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { status: true },
    });
    if (tenant?.status === 'active') return true;

    const message =
      tenant?.status === 'rejected'
        ? 'Business verification was rejected. Resubmit your documents to continue.'
        : tenant?.status === 'suspended'
          ? 'This business is suspended. Contact Kumvwa support.'
          : 'Business verification is still under review.';
    throw new ForbiddenException({
      message,
      code: 'TENANT_NOT_ACTIVE',
      tenantStatus: tenant?.status ?? 'missing',
    });
  }
}
