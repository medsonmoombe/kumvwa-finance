import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RiskModule } from '../risk/risk.module';
import {
  ClientLoanRequestsController,
  LenderLoanRequestsController,
  SharedLoanRequestsController,
} from './loan-requests.controller';
import { LoanRequestsService } from './loan-requests.service';

@Module({
  imports: [AuditModule, NotificationsModule, RiskModule],
  // See the route-order note in the controller file: the lender controller
  // MUST come first so `/inbox` is registered before the shared `/:id`.
  controllers: [
    LenderLoanRequestsController,
    SharedLoanRequestsController,
    ClientLoanRequestsController,
  ],
  providers: [LoanRequestsService],
  exports: [LoanRequestsService],
})
export class LoanRequestsModule {}