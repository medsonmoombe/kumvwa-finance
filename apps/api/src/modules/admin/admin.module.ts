import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminTenantsController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, AuditModule, NotificationsModule],
  controllers: [AdminTenantsController],
  providers: [AdminService],
})
export class AdminModule {}
