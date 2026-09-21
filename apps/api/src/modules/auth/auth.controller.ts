import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LogoutDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshDto,
  RegisterTenantDto,
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() // the global JwtAuthGuard is deny-by-default; these routes predate any token
  @Post('otp/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.auth.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Post('register/tenant')
  registerTenant(@Body() dto: RegisterTenantDto, @Req() req: Request) {
    return this.auth.registerTenant(dto, req);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto, req);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refreshToken, req);
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: LogoutDto, @Req() req: Request) {
    return this.auth.logout(dto.refreshToken, req);
  }

  @Get('me')
  me(@CurrentUser() user: { sub: string }) {
    return this.auth.me(user.sub);
  }
}
