import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Param,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { AllowUnverifiedTenant } from '../../common/guards/unverified-tenant.decorator';
import { AuthService } from './auth.service';
import {
  Set2faDto,
  ChangePasswordDto,
  ConsoleLoginDto,
  ConsoleVerifyDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDto,
  OtpRequestDto,
  OtpVerifyDto,
  RefreshDto,
  RegisterTenantDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Controller('auth')
@AllowUnverifiedTenant()
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
  @Post('console/login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  consoleLogin(@Body() dto: ConsoleLoginDto, @Req() req: Request) {
    return this.auth.consoleLogin(
      dto,
      req,
      req.headers['x-device-token'] as string | undefined,
    );
  }

  @Public()
  @Post('console/verify-2fa')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  consoleVerify2fa(@Body() dto: ConsoleVerifyDto, @Req() req: Request) {
    return this.auth.consoleVerify2fa(dto, req);
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

  @Get('2fa')
  get2fa(@CurrentUser() user: { sub: string }) {
    return this.auth.get2faStatus(user.sub);
  }

  @Patch('2fa')
  @HttpCode(200)
  set2fa(@Body() dto: Set2faDto, @CurrentUser() user: { sub: string }) {
    return this.auth.set2fa(user.sub, dto.enabled);
  }

  @Get('devices')
  devices(@CurrentUser() user: { sub: string }) {
    return this.auth.devices(user.sub);
  }

  @Delete('devices/:id')
  revokeDevice(
    @Param('id') id: string,
    @Req() req: Request,
    @CurrentUser() user: { sub: string },
  ) {
    return this.auth.revokeDevice(user.sub, id, req);
  }

  @Public()
  @Post('password/forgot')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto);
  }

  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.auth.resetPassword(dto, req);
  }

  @Post('password/change')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @CurrentUser() user: { sub: string },
  ) {
    return this.auth.changePassword(dto, user.sub, req);
  }
}
