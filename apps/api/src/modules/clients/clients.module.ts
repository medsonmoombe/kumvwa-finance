import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { TenantClientsController } from './tenant-clients.controller';

@Module({
  imports: [AuditModule, FilesModule],
  controllers: [ClientsController, TenantClientsController],
  providers: [ClientsService, NrcCryptoService],
  exports: [ClientsService],
})
export class ClientsModule {}
