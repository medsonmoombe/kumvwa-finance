import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ConfigModule } from './config/config.module';
import { loadEnv } from './config/env';
import { PrismaModule } from './infra/prisma.module';
import { RedisModule } from './infra/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';

const env = loadEnv();

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'prod' ? 'info' : 'debug',
        genReqId: () => randomUUID(),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.otpToken',
            'req.body.refreshToken',
            'req.body.code',
          ],
          censor: '[REDACTED]',
        },
        ...(env.NODE_ENV === 'prod'
          ? {}
          : { transport: { target: 'pino-pretty', options: { singleLine: true } } }),
      },
    }),
    PrismaModule,
    RedisModule,
    AuditModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    // Order matters: throttle → authenticate → authorize
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
