import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TermsModule } from '../terms/terms.module';
import {
  AdminAuditController,
  AdminClientsController,
  AdminPlatformController,
  AdminTenantsController,
  AdminUsersController,
} from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformModule } from './platform.module';

import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [AuthModule, AuditModule, FilesModule, NotificationsModule, PlatformModule, TermsModule, ReportsModule],
  controllers: [
    AdminTenantsController,
    AdminPlatformController,
    AdminUsersController,
    AdminClientsController,
    AdminAuditController,
  ],
  providers: [AdminService],
})
export class AdminModule {}

