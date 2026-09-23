import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn, IsString, MinLength } from 'class-validator';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenClaims } from '../../common/crypto/token.service';
import { PrismaService } from '../../infra/prisma.module';
import { NotificationsService } from './notifications.service';

// ───────────────────────── center ─────────────────────────

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() u: TokenClaims,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notifications.list(u.sub, cursor, Number(limit ?? 20));
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser() u: TokenClaims) {
    return this.notifications.markAllRead(u.sub);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.notifications.markRead(u.sub, id);
  }
}

// ───────────────────── device push tokens ─────────────────────

class RegisterDeviceDto {
  @IsString()
  @MinLength(20)
  token!: string;

  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}

class RemoveDeviceDto {
  @IsString()
  token!: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upsert by token: re-logins on the same device refresh ownership. */
  async register(userId: string, dto: RegisterDeviceDto) {
    await this.prisma.devicePushToken.upsert({
      where: { token: dto.token },
      create: { userId, token: dto.token, platform: dto.platform },
      update: { userId, platform: dto.platform },
    });
    return { registered: true };
  }

  async remove(userId: string, token: string) {
    await this.prisma.devicePushToken.deleteMany({
      where: { userId, token }, // deleteMany: no throw when absent
    });
    return { removed: true };
  }
}

@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  register(@CurrentUser() u: TokenClaims, @Body() dto: RegisterDeviceDto) {
    return this.devices.register(u.sub, dto);
  }

  @Delete()
  @HttpCode(200)
  remove(@CurrentUser() u: TokenClaims, @Body() dto: RemoveDeviceDto) {
    return this.devices.remove(u.sub, dto.token);
  }
}
