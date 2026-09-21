import { NrcCryptoService } from './nrc-crypto.service';

const env = {
  NRC_HMAC_KEY: 'k'.repeat(32),
  FIELD_ENCRYPTION_KEY: 'e'.repeat(32),
} as never;

describe('NrcCryptoService', () => {
  let svc: NrcCryptoService;
  beforeEach(() => (svc = new NrcCryptoService(env)));

  it('hashes deterministically and never leaks plaintext', () => {
    expect(svc.hash('245711/63/1')).toBe(svc.hash(' 245711/63/1 '));
    expect(svc.hash('245711/63/1')).not.toContain('245711');
  });

  it('encrypts and decrypts round-trip', () => {
    const enc = svc.encrypt('245711/63/1');
    expect(enc).not.toContain('245711');
    expect(svc.decrypt(enc)).toBe('245711/63/1');
  });

  it('produces fresh ciphertext per call (random IV)', () => {
    expect(svc.encrypt('245711/63/1')).not.toBe(svc.encrypt('245711/63/1'));
  });
});
