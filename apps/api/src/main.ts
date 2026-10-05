import 'dotenv/config';
import 'reflect-metadata';

import { CallHandler, ExecutionContext, Injectable, NestInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import {
  MAX_RECONCILE_ATTEMPTS,
  PaymentsService,
} from './modules/payments/payments.service';

/** Recursively turns BigInt into its decimal string, for JSON output only. */
function bigintToString(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(bigintToString);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, bigintToString(v)]),
    );
  }
  return value;
}

/** Keeps money BigInts from becoming 500s at the express serialiser. */
@Injectable()
class BigIntJsonInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(bigintToString));
  }
}

async function bootstrap(): Promise<void> {
  const env = loadEnv();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Keep the raw request body so payment webhooks can verify an HMAC
    // signature over the exact bytes the provider signed.
    rawBody: true,
  });
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
          connectSrc: isProd ? ["'self'"] : ["'self'", 'http://localhost:*', 'ws://localhost:*'],
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
  // Money is BigInt in the DB; JSON has no BigInt and express turns an
  // un-serialised one into a 500. Render them as strings app-wide so a
  // controller that forgets to map a field can't take an endpoint down.
  app.useGlobalInterceptors(new BigIntJsonInterceptor());
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

  // ── payments sweep ──
  // Advance in-flight charges against the provider and lapse intents nobody
  // approved. Provider adapters live in this process (not the worker) because
  // the registry is a Nest DI concern, so the reconciler has to run here.
  // Overlapping ticks are skipped rather than queued: a slow provider must not
  // pile up duplicate sweeps.
  const payments = app.get(PaymentsService);
  const log = app.get(Logger);
  let sweeping = false;
  setInterval(() => {
    if (sweeping) return;
    sweeping = true;
    void (async () => {
      try {
        const { checked, settled, abandoned } = await payments.reconcileInFlight();
        const expired = await payments.expireStaleIntents();
        if (settled > 0 || expired > 0) {
          log.log(
            `payments sweep: ${settled} settled, ${expired} expired (${checked} in flight)`,
          );
        }
        if (abandoned > 0) {
          log.warn(
            `payments: ${abandoned} charge(s) unresolved after ${MAX_RECONCILE_ATTEMPTS} attempts — ` +
              'left untouched for manual reconciliation. Check the Transactions tab.',
          );
        }
      } catch (e) {
        log.warn({ err: e }, 'payments sweep failed');
      } finally {
        sweeping = false;
      }
    })();
  }, 30_000);

  app.get(Logger).log(`API ready on :${env.PORT} (${env.NODE_ENV})`);
}

void bootstrap();
