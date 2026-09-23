import { Body, Controller, Get, Post } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { CreateLoanProductDto } from './dto/loan-products.dto';
import { LoanProductsService } from './loan-products.service';

@Roles('tenant_owner', 'tenant_staff')
@Controller('loan-products')
export class LoanProductsController {
  constructor(private readonly products: LoanProductsService) {}

  @Get()
  list(@CurrentUser() u: TokenClaims) {
    return this.products.list(u.tenantId!);
  }

  @Post()
  create(@CurrentUser() u: TokenClaims, @Body() dto: CreateLoanProductDto) {
    return this.products.create(u.tenantId!, u.sub, dto);
  }
}
