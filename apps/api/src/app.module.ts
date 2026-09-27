import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { MaintenanceGuard } from './common/guards/maintenance.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantAccessGuard } from './common/guards/tenant-access.guard';
import { ConfigModule } from './config/config.module';
import { loadEnv } from './config/env';
import { PrismaModule } from './infra/prisma.module';
import { RedisModule } from './infra/redis.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlatformModule } from './modules/admin/platform.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { InvitesModule } from './modules/invites/invites.module';
import { LoanProductsModule } from './modules/loan-products/loan-products.module';
import { LoanRequestsModule } from './modules/loan-requests/loan-requests.module';
import { LoansModule } from './modules/loans/loans.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PolicyModule } from './modules/policy/policy.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RiskModule } from './modules/risk/risk.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TermsModule } from './modules/terms/terms.module';
import { StaffModule } from './modules/staff/staff.module';

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
    RiskModule,
    NotificationsModule,
    InvitesModule,
    ClientsModule,
    LoansModule,
    LoanProductsModule,
    LoanRequestsModule,
    FilesModule,
    TenantsModule,
    TermsModule,
    StaffModule,
    PolicyModule,
    PlatformModule, // feature flags — also feeds the root MaintenanceGuard
    AdminModule,
    ReportsModule,
    ComplianceModule,
    HealthModule,
  ],
  providers: [
    // Order matters: throttle → authenticate → maintenance gate → authorize.
    // MaintenanceGuard runs AFTER JwtAuthGuard on purpose: the admin bypass
    // reads `req.user.role`, which only exists once authentication has run.
    // Public routes (health, login, 2FA verify) skip it via @Public().
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MaintenanceGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TenantAccessGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
