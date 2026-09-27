import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LoanPaymentsController, LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { MyLoansController } from './my-loans.controller';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [LoansController, MyLoansController, LoanPaymentsController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
