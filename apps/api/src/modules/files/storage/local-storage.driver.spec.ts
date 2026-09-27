import { ForbiddenException } from '@nestjs/common';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';

import { loadEnv } from '../../../config/env';
import { LocalStorageDriver } from './local-storage.driver';

function setupDriver(maxBytesDir?: string) {
  const storageDir =
    maxBytesDir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'kumvwa-storage-'));
  const env = loadEnv({
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    NRC_HMAC_KEY: 'c'.repeat(32),
    FIELD_ENCRYPTION_KEY: 'd'.repeat(32),
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: storageDir,
    API_PUBLIC_URL: 'http://localhost:8080/api/v1',
  });
  const driver = new LocalStorageDriver(env);
  return { driver, storageDir };
}

describe('LocalStorageDriver', () => {
  let storageDir = '';

  afterAll(() => {
    if (storageDir) fs.rmSync(storageDir, { recursive: true, force: true });
  });

  it('mints a signed upload URL its own verifier accepts', async () => {
    const d = setupDriver();
    storageDir = d.storageDir;
    await d.driver.init();

    const url = await d.driver.presignPut('tenants/t1/boz_certificate/abc', 'application/pdf');
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      'http://localhost:8080/api/v1/files/local-storage/upload',
    );

    const query = {
      key: parsed.searchParams.get('key')!,
      mime: parsed.searchParams.get('mime')!,
      expires: Number(parsed.searchParams.get('expires')),
      sig: parsed.searchParams.get('sig')!,
    };
    expect(d.driver.verifySignature('put', query)).toBe(true);
    // A download signature must never validate an upload, and vice versa.
    expect(d.driver.verifySignature('get', query)).toBe(false);
  });

  it('rejects tampered keys, tampered mime and expired URLs', async () => {
    const d = setupDriver();
    storageDir = d.storageDir;
    await d.driver.init();

    const url = new URL(await d.driver.presignGet('tenants/t1/boz_certificate/abc', 'image/png'));
    const query = {
      key: url.searchParams.get('key')!,
      mime: url.searchParams.get('mime')!,
      expires: Number(url.searchParams.get('expires')),
      sig: url.searchParams.get('sig')!,
    };

    expect(d.driver.verifySignature('get', query)).toBe(true);
    expect(
      d.driver.verifySignature('get', { ...query, key: 'tenants/other/boz_certificate/x' }),
    ).toBe(false);
    expect(d.driver.verifySignature('get', { ...query, mime: 'text/html' })).toBe(false);
    expect(d.driver.verifySignature('get', { ...query, expires: Date.now() - 1 })).toBe(false);
    expect(d.driver.verifySignature('get', { ...query, sig: 'f'.repeat(64) })).toBe(false);
  });

  it('refuses to resolve a key that escapes the docs folder', () => {
    const d = setupDriver();
    storageDir = d.storageDir;
    expect(() => d.driver.resolvePath('../../../windows/system32/x')).toThrow(ForbiddenException);
    // A normal nested key stays inside the folder.
    expect(d.driver.resolvePath('tenants/t1/boz_certificate/x')).toBe(
      path.join(d.storageDir, 'tenants', 't1', 'boz_certificate', 'x'),
    );
  });

  it('round-trips bytes: save → head → get', async () => {
    const d = setupDriver();
    storageDir = d.storageDir;
    await d.driver.init();

    const key = 'clients/nrc_photo/roundtrip';
    const payload = Buffer.from('%PDF-1.7 fake certificate bytes');
    const saved = await d.driver.saveStream(key, Readable.from(payload), 1024);
    expect(saved.size).toBe(payload.length);

    const head = await d.driver.head(key);
    expect(head).not.toBeNull();
    expect(head!.size).toBe(payload.length);
    expect(head!.etag).toHaveLength(32); // bare md5 hex

    const file = await d.driver.getStream(key);
    expect(file).not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of file!.stream) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString()).toBe(payload.toString());

    // Missing object is an expected outcome, not an error.
    expect(await d.driver.head('tenants/nope/missing')).toBeNull();
  });

  it('rejects an upload over the size ceiling and leaves nothing behind', async () => {
    const d = setupDriver();
    storageDir = d.storageDir;
    await d.driver.init();

    const key = 'clients/nrc_photo/too-big';
    await expect(
      d.driver.saveStream(key, Readable.from(Buffer.alloc(64, 1)), 32),
    ).rejects.toThrow(/maximum allowed size/);

    expect(await d.driver.head(key)).toBeNull();
  });
});
