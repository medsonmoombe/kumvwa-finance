import { Module } from '@nestjs/common';

import { PolicyModule } from '../policy/policy.module';
import { ClientRiskController } from './client-risk.controller';
import { TenantRiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  imports: [PolicyModule],
  controllers: [TenantRiskController, ClientRiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
