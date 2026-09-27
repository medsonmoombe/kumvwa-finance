import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { PlatformService } from './platform.service';

/**
 * Home of the platform kill-switches. Exported so the global MaintenanceGuard
 * (root scope), AuthModule (signup pause) and the admin suite can all read the
 * same flags without module cycles.
 */
@Module({
  imports: [AuditModule],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}
