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
      // The wording is an operator-facing setting: a scheduled window and an
      // incident need different messages, and support reads this one.
      const message = await this.platform.value<string>('maintenance_message');
      throw new HttpException(
        { message: message || 'Kumvwa is in scheduled maintenance. Please try again shortly.', code: 'MAINTENANCE' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return true;
  }
}
