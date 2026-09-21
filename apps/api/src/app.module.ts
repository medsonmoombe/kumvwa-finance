import { Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { LoggerModule } from 'nestjs-pino';

import { ConfigModule } from './config/config.module';
import { loadEnv } from './config/env';
import { PrismaModule } from './infra/prisma.module';
import { RedisModule } from './infra/redis.module';
import { HealthModule } from './modules/health/health.module';

const env = loadEnv();

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'prod' ? 'info' : 'debug',
        genReqId: () => randomUUID(),
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.otp',
            'req.body.code',
          ],
          censor: '[REDACTED]',
        },
        ...(env.NODE_ENV === 'prod'
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { singleLine: true },
              },
            }),
      },
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
  ],
})
export class AppModule {}
