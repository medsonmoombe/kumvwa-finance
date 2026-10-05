import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import {
  AdminBillingController,
  TenantBillingController,
} from './billing.controllers';
import { BillingService } from './billing.service';

@Module({
  imports: [AuditModule],
  controllers: [TenantBillingController, AdminBillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
