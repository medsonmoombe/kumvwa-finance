import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Readable } from 'node:stream';

import type { Env } from '../../../config/env';
import type {
  StorageDriver,
  StorageSelfTest,
  StoredObject,
} from './storage.interface';

export const PRESIGN_TTL_SEC = 900;

export function resolveStorageDir(configuredDir: string): string {
  if (path.isAbsolute(configuredDir)) {
    return configuredDir;
  }
  const cwd = process.cwd();
  // 1. Direct candidate from cwd (e.g. repo root)
  const candidate1 = path.resolve(cwd, configuredDir);
  if (fs.existsSync(candidate1)) {
    return candidate1;
  }
  // 2. Relative candidate if cwd is apps/api
  const candidate2 = path.resolve(cwd, '..', '..', configuredDir);
  if (fs.existsSync(candidate2)) {
    return candidate2;
  }
  // Default: create at candidate1
  fs.mkdirSync(candidate1, { recursive: true });
  return candidate1;
}

export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly storageDir: string;
  private readonly secretKey: string;
  private readonly apiPublicUrl: string;

  constructor(env: Env) {
    this.storageDir = resolveStorageDir(env.LOCAL_STORAGE_DIR);
    this.secretKey = env.FIELD_ENCRYPTION_KEY;
    this.apiPublicUrl = env.API_PUBLIC_URL.replace(/\/+$/, '');
  }

  async init(): Promise<void> {
    await fs.promises.mkdir(this.storageDir, { recursive: true });
    this.logger.log(`Local file storage active at "${this.storageDir}"`);

    const result = await this.selfTest();
    if (result.ok) {
      this.logger.log(`Storage self-test passed (${result.detail})`);
    } else {
      this.logger.error(
        `Storage self-test FAILED (${result.detail}). Every upload will fail.`,
      );
    }
  }

  /** Local disk is either writable or it is not — same contract as S3. */
  async selfTest(): Promise<StorageSelfTest> {
    const fullPath = this.resolvePath('_diagnostics/storage-probe');
    try {
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, 'kumvwa storage probe');
      await fs.promises.readFile(fullPath);
      await fs.promises.rm(fullPath, { force: true });
      return {
        ok: true,
        detail: `wrote, read back and deleted a probe under "${this.storageDir}"`,
      };
    } catch (err) {
      return {
        ok: false,
        detail: `${(err as Error).message ?? err}`,
      };
    }
  }

  resolvePath(key: string): string {
    const safeKey = key.replace(/\\/g, '/').replace(/^\/+/, '');
    const fullPath = path.resolve(this.storageDir, safeKey);
    // Path traversal guard: must reside strictly within storageDir
    if (!fullPath.startsWith(this.storageDir)) {
      throw new ForbiddenException('Invalid storage key');
    }
    return fullPath;
  }

  sign(action: 'put' | 'get', key: string, mime: string, expires: number): string {
    return createHmac('sha256', this.secretKey)
      .update(`${action}:${key}:${mime}:${expires}`)
      .digest('hex');
  }

  verifySignature(
    action: 'put' | 'get',
    query: { key: string; mime?: string; expires: number; sig: string },
  ): boolean {
    const { key, mime = '', expires, sig } = query;
    if (Date.now() > expires) return false;
    const expected = this.sign(action, key, mime, expires);
    const sigBuf = Buffer.from(sig, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  }

  presignPut(key: string, mime: string): Promise<string> {
    const expires = Date.now() + PRESIGN_TTL_SEC * 1000;
    const sig = this.sign('put', key, mime, expires);
    const params = new URLSearchParams({
      key,
      mime,
      expires: String(expires),
      sig,
    });
    return Promise.resolve(
      `${this.apiPublicUrl}/files/local-storage/upload?${params.toString()}`,
    );
  }

  presignGet(key: string, mime = ''): Promise<string> {
    const expires = Date.now() + PRESIGN_TTL_SEC * 1000;
    const sig = this.sign('get', key, mime, expires);
    const params = new URLSearchParams({
      key,
      mime,
      expires: String(expires),
      sig,
    });
    return Promise.resolve(
      `${this.apiPublicUrl}/files/local-storage/download?${params.toString()}`,
    );
  }

  async head(key: string): Promise<StoredObject | null> {
    const fullPath = this.resolvePath(key);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) return null;
      const etag = await this.computeMd5(fullPath);
      return { size: stat.size, etag };
    } catch {
      return null;
    }
  }

  async saveStream(
    key: string,
    stream: NodeJS.ReadableStream,
    maxBytes: number,
  ): Promise<StoredObject> {
    const fullPath = this.resolvePath(key);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });

    const hash = createHash('md5');
    let size = 0;

    await new Promise<void>((resolve, reject) => {
      const out = fs.createWriteStream(fullPath);
      let settled = false;
      // Abort → close the handle first, then delete, so a half-written file
      // can never be left behind for `head()`/`confirm()` to pick up.
      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        stream.unpipe(out);
        out.once('close', () => fs.rm(fullPath, { force: true }, () => reject(err)));
        out.destroy();
      };

      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        // The pre-signed URL is minted only after the 10 MB DTO check — this
        // enforces the same ceiling on the bytes that actually arrive.
        if (size > maxBytes) {
          (stream as unknown as Readable).destroy();
          fail(new BadRequestException('File exceeds the maximum allowed size'));
          return;
        }
        hash.update(chunk);
      });
      stream.pipe(out);
      out.on('finish', () => {
        if (settled) return;
        settled = true;
        resolve();
      });
      out.on('error', fail);
      stream.on('error', fail);
    });

    return { size, etag: hash.digest('hex') };
  }

  async getStream(
    key: string,
  ): Promise<{ stream: fs.ReadStream; size: number } | null> {
    const fullPath = this.resolvePath(key);
    try {
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) return null;
      return {
        stream: fs.createReadStream(fullPath),
        size: stat.size,
      };
    } catch {
      return null;
    }
  }

  private async computeMd5(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('md5');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
