import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  TenantPublicController,
  TenantsController,
} from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  // AuthModule exports NrcCryptoService (owner NRC encryption).
  imports: [AuthModule, AuditModule, FilesModule, NotificationsModule],
  controllers: [TenantsController, TenantPublicController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
