import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import {
  ClientFilesController,
  FilesDownloadController,
  FilesController,
  LocalStorageController,
  PlatformProfileFilesController,
} from './files.controller';
import { FilesService } from './files.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuditModule],
  controllers: [
    FilesController,
    FilesDownloadController,
    ClientFilesController,
    PlatformProfileFilesController,
    LocalStorageController,
  ],
  providers: [FilesService, StorageService],
  exports: [FilesService, StorageService],
})
export class FilesModule {}
