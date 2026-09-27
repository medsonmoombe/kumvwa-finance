import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { RequirePermissions } from '../../common/guards/permissions.decorator';
import { CreateLoanProductDto, UpdateProductDto } from './dto/loan-products.dto';
import { LoanProductsService } from './loan-products.service';

@Roles('tenant_owner', 'tenant_staff')
@RequirePermissions('products.manage')
@Controller('loan-products')
export class LoanProductsController {
  constructor(private readonly products: LoanProductsService) {}

  // Route order matters (Nest matches in declaration order): the literal
  // routes register before the `:id` pair, so list/create can never be
  // captured by the parameterised ones.
  @Get()
  list(@CurrentUser() u: TokenClaims) {
    return this.products.list(u.tenantId!);
  }

  @Post()
  create(@CurrentUser() u: TokenClaims, @Body() dto: CreateLoanProductDto) {
    return this.products.create(u.tenantId!, u.sub, dto);
  }

  @Get(':id')
  detail(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.products.detail(u.tenantId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(u.tenantId!, u.sub, id, dto);
  }
}
