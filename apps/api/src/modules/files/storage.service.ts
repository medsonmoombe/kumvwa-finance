import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';
import {
  LocalStorageDriver,
  PRESIGN_TTL_SEC,
} from './storage/local-storage.driver';
import { S3StorageDriver } from './storage/s3-storage.driver';
import type { StorageDriver, StoredObject } from './storage/storage.interface';

export { PRESIGN_TTL_SEC };
export type { StoredObject };

/**
 * Storage provider coordinator.
 * Configured via `STORAGE_DRIVER` env variable:
 * - 'local' (default): saves/retrieves docs in project `./docs` folder via API streaming
 * - 's3': uses MinIO in dev or real S3/Cloudflare R2 in prod
 *
 * Switching between storage systems requires only changing `STORAGE_DRIVER`.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: StorageDriver;
  private readonly localDriver?: LocalStorageDriver;

  constructor(@Inject(ENV) private readonly env: Env) {
    if (env.STORAGE_DRIVER === 'local') {
      this.localDriver = new LocalStorageDriver(env);
      this.driver = this.localDriver;
      this.logger.log('Storage service initialized with local disk driver');
      if (env.NODE_ENV === 'prod') {
        // Louder than a warn on purpose: this is the config that silently eats
        // BOZ certificates, logos and NRC photos on an ephemeral filesystem.
        this.logger.error(
          `STORAGE_DRIVER=local in prod writes documents to "${env.LOCAL_STORAGE_DIR}" on this instance. ` +
            'Without a persistent volume every upload is lost on the next deploy — set STORAGE_DRIVER=s3.',
        );
      }
    } else {
      this.driver = new S3StorageDriver(env);
      this.logger.log('Storage service initialized with S3/MinIO driver');
    }
  }

  async onModuleInit(): Promise<void> {
    await this.driver.init();
  }

  presignPut(key: string, mime: string): Promise<string> {
    return this.driver.presignPut(key, mime);
  }

  presignGet(key: string, mime?: string): Promise<string> {
    return this.driver.presignGet(key, mime);
  }

  head(key: string): Promise<StoredObject | null> {
    return this.driver.head(key);
  }

  isLocal(): boolean {
    return Boolean(this.localDriver);
  }

  getLocalDriver(): LocalStorageDriver | undefined {
    return this.localDriver;
  }
}

