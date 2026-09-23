import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { LoanProductsController } from './loan-products.controller';
import { LoanProductsService } from './loan-products.service';

@Module({
  imports: [AuditModule],
  controllers: [LoanProductsController],
  providers: [LoanProductsService],
  exports: [LoanProductsService],
})
export class LoanProductsModule {}
