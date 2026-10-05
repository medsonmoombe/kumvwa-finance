import { Module } from '@nestjs/common';

import { EmailService } from '../../common/email/email.service';
import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PasswordService } from '../../common/crypto/password.service';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { FilesModule } from '../files/files.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [AuditModule, FilesModule, BillingModule],
  controllers: [InvitesController],
  providers: [InvitesService, EmailService, NrcCryptoService, PasswordService],
  exports: [InvitesService],
})
export class InvitesModule {}
