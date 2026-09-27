import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PlatformService } from '../../modules/admin/platform.service';
import { IS_PUBLIC } from './public.decorator';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(
    private readonly platform: PlatformService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true; // health, docs, login still answer

    const { user } = context.switchToHttp().getRequest();
    if (user?.role === 'platform_admin' || user?.permissions?.includes('*')) return true;

    const maintenance = await this.platform.getFlag('maintenance_mode');
    if (maintenance) {
      throw new HttpException(
        { message: 'Kumvwa is in scheduled maintenance. Please try again shortly.', code: 'MAINTENANCE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return true;
  }
}
