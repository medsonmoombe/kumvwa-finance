import { Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { resolveS3Region, type Env } from '../../../config/env';
import type { StorageDriver, StoredObject } from './storage.interface';

export const PRESIGN_TTL_SEC = 900;

export class S3StorageDriver implements StorageDriver {
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(env: Env) {
    this.bucket = env.S3_BUCKET;
    const region = resolveS3Region(env);
    this.logger.log(`S3 storage signing for region "${region}"`);
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region,
      // Both MinIO and Backblaze accept path-style addressing; virtual-host
      // style would additionally require wildcard DNS + a matching cert.
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  async init(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created storage bucket "${this.bucket}"`);
      } catch (err) {
        this.logger.warn(
          { err },
          `Storage bucket "${this.bucket}" is not reachable yet`,
        );
      }
    }
  }

  async presignPut(key: string, mime: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mime,
      }),
      { expiresIn: PRESIGN_TTL_SEC },
    );
  }

  /** S3 stores ContentType at PUT time; echo it so downloads render inline. */
  async presignGet(key: string, mime?: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(mime ? { ResponseContentType: mime } : {}),
      }),
      { expiresIn: PRESIGN_TTL_SEC },
    );
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: res.ContentLength ?? 0,
        etag: (res.ETag ?? '').replaceAll('"', ''),
      };
    } catch {
      return null;
    }
  }
}
