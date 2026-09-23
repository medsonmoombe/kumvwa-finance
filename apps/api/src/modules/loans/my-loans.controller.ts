import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';
import { LoansService } from './loans.service';

@Roles('client')
@Controller('my')
export class MyLoansController {
  constructor(private readonly loans: LoansService) {}

  @Get('loans')
  list(@CurrentUser() u: TokenClaims) {
    return this.loans.myLoans(u.clientId!);
  }
}
