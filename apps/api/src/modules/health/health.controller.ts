import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import Redis from 'ioredis';

import { PrismaService } from '../../infra/prisma.module';
import { REDIS } from '../../infra/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  async readiness(): Promise<{ status: string; checks: Record<string, string> }> {
    const checks: Record<string, string> = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks['db'] = 'ok';
    } catch {
      checks['db'] = 'fail';
    }

    try {
      await this.redis.ping();
      checks['redis'] = 'ok';
    } catch {
      checks['redis'] = 'fail';
    }

    const healthy = Object.values(checks).every((v) => v === 'ok');
    if (!healthy) {
      throw new HttpException(
        { status: 'degraded', checks },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ready', checks };
  }
}
