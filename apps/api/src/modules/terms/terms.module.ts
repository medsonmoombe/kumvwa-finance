import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { TermsController, TenantTermsController } from './terms.controller';
import { TermsService } from './terms.service';

@Module({
  imports: [AuditModule, FilesModule],
  controllers: [TermsController, TenantTermsController],
  providers: [TermsService],
  exports: [TermsService],
})
export class TermsModule {}
