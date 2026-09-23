import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { ENV, type Env } from '../../config/env';

/** Presigned URLs are short-lived: long enough to upload a scan, short enough that a leaked URL is useless. */
export const PRESIGN_TTL_SEC = 900;

export interface StoredObject {
  size: number;
  etag: string;
}

/**
 * S3-compatible storage (MinIO in dev, real S3/R2 in prod). Documents are
 * BOZ certificates — PII — so the API never proxies bytes: it only mints
 * short-lived presigned URLs and lets the client talk to storage directly.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      // MinIO ignores region, but SigV4 requires one to sign the request.
      region: 'us-east-1',
      // MinIO serves path-style; virtual-host style needs wildcard DNS.
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }

  /** Dev convenience: make `docker compose up` alone sufficient to upload. */
  async onModuleInit(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created storage bucket "${this.bucket}"`);
      } catch (err) {
        // Prod buckets are provisioned by infra, not the app — never fatal.
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

  async presignGet(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: PRESIGN_TTL_SEC },
    );
  }

  /** HEAD the object so `confirm` can reject an upload that never landed. */
  async head(key: string): Promise<StoredObject | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: res.ContentLength ?? 0,
        // ETag arrives quoted ("abc") — store it bare so it's comparable.
        etag: (res.ETag ?? '').replaceAll('"', ''),
      };
    } catch {
      return null; // missing object is an expected outcome, not an error
    }
  }
}
