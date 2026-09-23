import { Module } from '@nestjs/common';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PasswordService } from '../../common/crypto/password.service';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';

@Module({
  imports: [AuditModule, FilesModule],
  controllers: [InvitesController],
  providers: [InvitesService, NrcCryptoService, PasswordService],
  exports: [InvitesService],
})
export class InvitesModule {}
