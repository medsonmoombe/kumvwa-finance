import { Module } from '@nestjs/common';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { TenantClientsController } from './tenant-clients.controller';

@Module({
  // `clients/me` must be matched before the bare `clients` list.
  controllers: [ClientsController, TenantClientsController],
  providers: [ClientsService, NrcCryptoService],
  exports: [ClientsService],
})
export class ClientsModule {}
