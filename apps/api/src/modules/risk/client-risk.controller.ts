import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';
import { RiskService } from './risk.service';

/**
 * Borrower-facing reads. `GET /credit-limit` is the same server-computed
 * figure the request flow enforces — the app displays it, the API applies
 * it, so the banner never disagrees with the submit-time rejection.
 */
@Roles('client')
@Controller()
export class ClientRiskController {
  constructor(private readonly risk: RiskService) {}

  @Get('credit-limit')
  creditLimit(@CurrentUser() u: TokenClaims) {
    return this.risk.myCreditLimit(u.clientId!);
  }
}
