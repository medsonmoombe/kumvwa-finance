import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import {
  ClientCreditController,
  TenantPolicyController,
} from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  imports: [AuditModule],
  controllers: [TenantPolicyController, ClientCreditController],
  providers: [PolicyService],
  exports: [PolicyService],
})
export class PolicyModule {}
