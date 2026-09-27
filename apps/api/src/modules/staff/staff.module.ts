import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
