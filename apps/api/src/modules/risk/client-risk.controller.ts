import { Controller, Get, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';
import { PolicyService } from '../policy/policy.service';

/**
 * Borrower-facing reads. `GET /credit-limit?lenderId=` is the same
 * server-computed figure the request flow enforces — the app displays it,
 * the API applies it, so the banner never disagrees with the submit-time
 * rejection. Scoped per lender (M5 ladder); omitted lenderId falls back to
 * the client's first linked lender.
 */
@Roles('client')
@Controller()
export class ClientRiskController {
  constructor(private readonly policy: PolicyService) {}

  @Get('credit-limit')
  creditLimit(@CurrentUser() u: TokenClaims, @Query('lenderId') lenderId?: string) {
    return this.policy.resolve(u.clientId!, lenderId);
  }
}