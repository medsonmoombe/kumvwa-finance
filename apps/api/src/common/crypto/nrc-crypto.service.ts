import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { ENV, type Env } from '../../config/env';

/**
 * NRC handling per data model:
 *  - hash → HMAC-SHA256(NRC_HMAC_KEY): the dedupe/lookup key (never reversed)
 *  - encrypted → AES-256-GCM(FIELD_ENCRYPTION_KEY): display, decryption audited
 */
@Injectable()
export class NrcCryptoService {
  private readonly hmacKey: Buffer;
  private readonly encKey: Buffer;

  constructor(@Inject(ENV) env: Env) {
    this.hmacKey = Buffer.from(env.NRC_HMAC_KEY, 'utf8');
    this.encKey = Buffer.from(
      env.FIELD_ENCRYPTION_KEY.padEnd(32, '!'),
      'utf8',
    ).subarray(0, 32);
  }

  hash(nrc: string): string {
    return createHmac('sha256', this.hmacKey).update(nrc.trim()).digest('hex');
  }

  encrypt(nrc: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encKey, iv);
    const enc = Buffer.concat([cipher.update(nrc, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.encKey,
      Buffer.from(ivB64!, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64!, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64!, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }
}
