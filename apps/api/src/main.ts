import 'dotenv/config';
import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
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

  if (env.NODE_ENV !== 'prod') {
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
