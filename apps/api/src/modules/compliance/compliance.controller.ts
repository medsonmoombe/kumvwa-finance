import { Controller, Get, Post } from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { ComplianceService } from './compliance.service';

/** Data-subject rights — always scoped to the caller's own client record. */
@Roles('client')
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('export')
  export(@CurrentUser() u: TokenClaims) {
    return this.compliance.exportMyData(u.clientId!);
  }

  @Post('delete-request')
  deleteRequest(@CurrentUser() u: TokenClaims) {
    return this.compliance.requestDeletion(u.clientId!);
  }
}
