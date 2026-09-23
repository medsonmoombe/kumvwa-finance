import 'dotenv/config';
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const isProd = env.NODE_ENV === 'prod';
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger UI injects inline script/styles; it is served in dev only,
          // so prod can stay strict without breaking the docs page.
          scriptSrc: isProd ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      // The console opens presigned MinIO/S3 objects — cross-origin by design.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Correlate an API response with its log line (pino already mints req.id).
  app.use((req: Request, res: Response, next: NextFunction) => {
    // pino-http's genReqId() yields a UUID string; the type is deliberately
    // broad, so only primitive ids are echoed back.
    const id = req.id;
    res.setHeader(
      'X-Request-Id',
      typeof id === 'string' || typeof id === 'number' ? `${id}` : '',
    );
    next();
  });

  app.enableCors({
    origin: env.CORS_ORIGINS.length > 0 ? env.CORS_ORIGINS : true, // true = DEV only
  });
  app.setGlobalPrefix('api/v1'); // matches the mobile app's Env.apiBaseUrl
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  if (!isProd) {
    const docConfig = new DocumentBuilder()
      .setTitle('Kumvwa Finance API')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      'docs',
      app,
      SwaggerModule.createDocument(app, docConfig),
    );
  }

  await app.listen(env.PORT);
  app.get(Logger).log(`API ready on :${env.PORT} (${env.NODE_ENV})`);
}

void bootstrap();
