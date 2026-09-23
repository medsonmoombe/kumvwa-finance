import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';

@Module({
  // AuthModule exports NrcCryptoService (self-export decryption).
  imports: [AuthModule, AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
})
export class ComplianceModule {}
