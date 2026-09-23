import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';
import { CompleteInviteDto, CreateInviteDto } from './dto/invites.dto';
import { InvitesService } from './invites.service';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Roles('tenant_owner', 'tenant_staff')
  @Post()
  create(@CurrentUser() u: TokenClaims, @Body() dto: CreateInviteDto) {
    return this.invites.create(u.tenantId!, u.sub, dto);
  }

  @Roles('tenant_owner', 'tenant_staff')
  @Get()
  list(@CurrentUser() u: TokenClaims, @Query('status') status?: string) {
    return this.invites.listForTenant(u.tenantId!, status);
  }

  /** The invited client has no account yet — this route must be open. */
  @Public()
  @Get(':code')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  lookup(@Param('code') code: string) {
    return this.invites.lookup(code);
  }

  @Public()
  @Post(':code/complete')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  complete(
    @Param('code') code: string,
    @Body() dto: CompleteInviteDto,
    @Req() req: Request,
  ) {
    return this.invites.complete(code, dto, req);
  }
}
