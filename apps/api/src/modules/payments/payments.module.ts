import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { LoansModule } from '../loans/loans.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import {
  AdminPaymentsController,
  DisbursementsController,
  PaymentsController,
} from './payments.controller';
import { PaymentsService } from './payments.service';
import { LedgerService } from './ledger.service';
import { AirtelMoneyProvider } from './providers/airtel.provider';
import { CardPspProvider } from './providers/card.provider';
import { MtnMomoProvider } from './providers/mtn-momo.provider';
import { SandboxProvider } from './providers/sandbox.provider';
import { ZamtelKwachaProvider } from './providers/zamtel.provider';
import { PaymentProviderRegistry } from './providers/provider.registry';

@Module({
  imports: [AuditModule, NotificationsModule, BillingModule, LoansModule],
  controllers: [
    PaymentsController,
    DisbursementsController,
    AdminPaymentsController,
    PaymentWebhooksController,
  ],
  providers: [
    PaymentsService,
    LedgerService,
    SandboxProvider,
    MtnMomoProvider,
    AirtelMoneyProvider,
    ZamtelKwachaProvider,
    CardPspProvider,
    PaymentProviderRegistry,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
