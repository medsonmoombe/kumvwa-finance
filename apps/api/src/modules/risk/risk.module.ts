import { Module } from '@nestjs/common';

import { ClientRiskController } from './client-risk.controller';
import { TenantRiskController } from './risk.controller';
import { RiskService } from './risk.service';

@Module({
  controllers: [TenantRiskController, ClientRiskController],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
