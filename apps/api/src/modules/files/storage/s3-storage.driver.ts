import { Logger } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { resolveS3Region, type Env } from '../../../config/env';
import type {
  StorageDriver,
  StorageSelfTest,
  StoredObject,
} from './storage.interface';

export const PRESIGN_TTL_SEC = 900;

/**
 * A probe object rather than a tenant path, so it can never collide with — or
 * be mistaken for — a real document. Lives outside the `tenants/` and
 * `clients/` prefixes the app ever reads.
 */
const PROBE_KEY = '_diagnostics/storage-probe';

/** Access key ids are half-public, but the log only needs to identify one. */
function maskKey(key: string): string {
  return key.length <= 6 ? '***' : `${key.slice(0, 6)}…`;
}

/**
 * Flattens an AWS SDK failure into one log line. The SDK buries the useful part
 * — Backblaze's `Code`/`Message` XML and the HTTP status — across `name`,
 * `message`, `$metadata` and `cause`, so a bare `err` object prints as
 * `[object Object]` exactly when it matters most.
 */
export function describeS3Error(err: unknown): string {
  if (!err || typeof err !== 'object') return String(err);
  const e = err as {
    name?: string;
    message?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
    cause?: { code?: string; message?: string };
  };
  const parts = [e.name ?? 'Error'];
  if (e.Code && e.Code !== e.name) parts.push(`(${e.Code})`);
  if (e.$metadata?.httpStatusCode) {
    parts.push(`HTTP ${e.$metadata.httpStatusCode}`);
  }
  parts.push(`— ${e.message ?? 'no message'}`);
  if (e.cause?.code) parts.push(`[cause: ${e.cause.code}]`);
  return parts.join(' ');
}

export class S3StorageDriver implements StorageDriver {
  private readonly logger = new Logger(S3StorageDriver.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly region: string;
  private readonly accessKey: string;

  constructor(env: Env) {
    this.bucket = env.S3_BUCKET;
    this.endpoint = env.S3_ENDPOINT;
    this.accessKey = env.S3_ACCESS_KEY;
    this.region = resolveS3Region(env);
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: this.region,
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
    // Printed unconditionally: every value below is signed into the URLs the
    // browser gets, so seeing them together is what makes a bad deploy obvious.
    this.logger.log(
      `S3 storage configured: endpoint="${this.endpoint}", region="${this.region}", ` +
        `bucket="${this.bucket}", accessKey="${maskKey(this.accessKey)}"`,
    );

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Storage bucket "${this.bucket}" is reachable`);
    } catch (err) {
      this.logger.warn(
        `HeadBucket failed for "${this.bucket}": ${describeS3Error(err)}`,
      );
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
        this.logger.log(`Created storage bucket "${this.bucket}"`);
      } catch (createErr) {
        this.logger.warn(
          `Could not create storage bucket "${this.bucket}": ${describeS3Error(createErr)}`,
        );
      }
    }

    const result = await this.selfTest();
    if (result.ok) {
      this.logger.log(
        `Storage self-test passed (${result.detail}). Uploads, downloads and ` +
          'confirm() are all backed by a working credential — a browser upload ' +
          'that still fails is a client-side block (bucket CORS rules or a ' +
          'mixed-content http URL), not a credential or bucket problem.',
      );
    } else {
      // error, not warn: presigning succeeds against an unusable credential, so
      // without this line the failure only ever surfaces as a failed user upload.
      this.logger.error(
        `Storage self-test FAILED (${result.detail}). Presigned URLs will be ` +
          'minted but every upload will fail. Check S3_REGION, S3_BUCKET and ' +
          'that the key has readFiles/writeFiles capability for this bucket.',
      );
    }
  }

  /**
   * Proves the credential can write and read. `presignPut` never contacts the
   * backend, so it is no evidence of anything — only an actual PUT is.
   */
  async selfTest(): Promise<StorageSelfTest> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: PROBE_KEY,
          Body: 'kumvwa storage probe',
          ContentType: 'text/plain',
        }),
      );
    } catch (err) {
      return { ok: false, detail: `write failed: ${describeS3Error(err)}` };
    }

    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: PROBE_KEY }),
      );
      await res.Body?.transformToString();
    } catch (err) {
      return { ok: false, detail: `read-back failed: ${describeS3Error(err)}` };
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: PROBE_KEY }),
      );
    } catch (err) {
      // Cleanup only — the probe already proved write+read.
      this.logger.warn(
        `Could not delete the self-test probe "${PROBE_KEY}": ${describeS3Error(err)}`,
      );
    }

    return {
      ok: true,
      detail: `wrote, read back and deleted "${PROBE_KEY}"`,
    };
  }

  async presignPut(key: string, mime: string): Promise<string> {
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mime,
      }),
      { expiresIn: PRESIGN_TTL_SEC },
    );
    // `origin` only — the query string carries a live signature, and the scheme
    // is the part worth watching: an `http` upload URL is blocked by any https
    // console before the request ever leaves the browser.
    this.logger.debug(`Presigned PUT for "${key}" against ${safeOrigin(url)}`);
    return url;
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
    } catch (err) {
      // A missing object and a rejected credential are the same `null` to the
      // caller. Log which one it was, or `confirm()` failures stay invisible.
      this.logger.warn(
        `HeadObject failed for "${key}": ${describeS3Error(err)}`,
      );
      return null;
    }
  }
}

/** Scheme + host of a URL, dropping any query that may carry a signature. */
function safeOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return 'an unparseable endpoint';
  }
}
