import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';

import { LoanRequestsService } from './loan-requests.service';
import {
  ApproveRequestDto,
  CreateLoanRequestDto,
  RejectRequestDto,
} from './dto/loan-requests.dto';

// NOTE on route order: Nest registers Express routes in controller-declaration
// order, so the LENDER controller must come before the others: its `GET /inbox`
// must be registered before the shared `GET /:id`, otherwise a lender's
// `/inbox` call would match `:id = 'inbox'` and be rejected. The routes are:
//   1. Lender:  GET /loan-requests/inbox   (tenant only)
//   2. Shared:  GET /loan-requests/:id     (client + tenant — one route so the
//               client detail isn't shadowed by a tenant-only `:id`)
//   3. Client:  POST/GET /loan-requests    (client only)
//   4. Lender:  POST :id/approve|reject    (tenant only, distinct path)

@Roles('tenant_owner', 'tenant_staff')
@Controller('loan-requests')
export class LenderLoanRequestsController {
  constructor(private readonly requests: LoanRequestsService) {}

  @Get('inbox')
  inbox(@CurrentUser() u: TokenClaims, @Query('status') status?: string) {
    return this.requests.list(u, status);
  }

  @Post(':id/approve')
  approve(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: ApproveRequestDto,
  ) {
    return this.requests.approve(u.tenantId!, u.sub, id, dto);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() u: TokenClaims,
    @Param('id') id: string,
    @Body() dto: RejectRequestDto,
  ) {
    return this.requests.reject(u.tenantId!, u.sub, id, dto);
  }
}

@Roles('client', 'tenant_owner', 'tenant_staff')
@Controller('loan-requests')
export class SharedLoanRequestsController {
  constructor(private readonly requests: LoanRequestsService) {}

  // Object-level isolation lives in the service: a client can only read their
  // own requests, a tenant only theirs. Register AFTER `/inbox` so a lender's
  // `/inbox` call isn't captured by `:id`.
  @Get(':id')
  detail(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.requests.get(u, id);
  }
}

@Roles('client')
@Controller('loan-requests')
export class ClientLoanRequestsController {
  constructor(private readonly requests: LoanRequestsService) {}

  @Post()
  create(@CurrentUser() u: TokenClaims, @Body() dto: CreateLoanRequestDto) {
    return this.requests.create(u.clientId!, dto);
  }

  @Get()
  list(@CurrentUser() u: TokenClaims, @Query('status') status?: string) {
    return this.requests.list(u, status);
  }
}