import { Body, Controller, Get, Param, Patch, Put } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';
import { UpdateClientProfileDto, UpdateProfileDto } from './dto/clients.dto';
import { ClientsService, parseNrcSide } from './clients.service';

@Roles('client')
@Controller('clients/me')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  me(@CurrentUser() u: TokenClaims) {
    return this.clients.me(u.clientId!);
  }

  @Get('lenders')
  lenders(@CurrentUser() u: TokenClaims) {
    return this.clients.lenders(u.clientId!);
  }

  /**
   * The borrower's own uploaded NRC photo, so the app can show them what is
   * on file. Presigned per request: URLs are short-lived, so the viewer mints
   * a fresh one every time it opens instead of caching one.
   */
  @Get('nrc-photo/:side')
  nrcPhoto(@CurrentUser() u: TokenClaims, @Param('side') side: string) {
    return this.clients.ownNrcPhotoUrl(u.clientId!, parseNrcSide(side));
  }

  /** Post-login KYC wizard target. Returns the refreshed profile + %. */
  @Patch('profile')
  updateProfile(
    @CurrentUser() u: TokenClaims,
    @Body() dto: UpdateClientProfileDto,
  ) {
    return this.clients.updateProfile(u.clientId!, dto);
  }

  /** First-login profile stepper — richer profile, marks the profile complete. */
  @Put('profile')
  async submitProfile(
    @CurrentUser() u: TokenClaims,
    @Body() dto: UpdateProfileDto,
  ) {
    const cid = await this.clients.assertSelf(u.clientId!);
    return this.clients.submitProfile(cid, dto);
  }
}
