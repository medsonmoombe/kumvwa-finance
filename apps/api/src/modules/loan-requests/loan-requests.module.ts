import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlatformModule } from '../admin/platform.module';
import { PolicyModule } from '../policy/policy.module';
import {
  ClientLoanRequestsController,
  LenderLoanRequestsController,
  SharedLoanRequestsController,
} from './loan-requests.controller';
import { LoanRequestsService } from './loan-requests.service';

@Module({
  imports: [
    AuditModule,
    NotificationsModule,
    PlatformModule,
    PolicyModule,
    // Approval initiates the payout, so the payments engine must be reachable.
    // No cycle: PaymentsModule → LoansModule → Audit/Notifications only.
    PaymentsModule,
  ],
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