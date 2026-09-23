import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { ReportsService } from './reports.service';

@Roles('tenant_owner', 'tenant_staff')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  summary(@CurrentUser() u: TokenClaims) {
    return this.reports.summary(u.tenantId!);
  }

  @Get('monthly')
  monthly(@CurrentUser() u: TokenClaims) {
    return this.reports.monthly(u.tenantId!);
  }

  /**
   * `@Res` deliberately bypasses Nest's serializer — this endpoint emits raw
   * CSV, and must not be JSON-wrapped or intercepted.
   */
  @Get('loans.csv')
  async csv(@CurrentUser() u: TokenClaims, @Res() res: Response) {
    const csv = await this.reports.loansCsv(u.tenantId!);
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="kumvwa-loans-${stamp}.csv"`,
    );
    res.send(csv);
  }
}
