import { Module } from '@nestjs/common';

import {
  DevicesController,
  DevicesService,
  NotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService, DevicesService],
  exports: [NotificationsService, DevicesService],
})
export class NotificationsModule {}
