import { hash, verify } from '@node-rs/argon2';
import { Injectable } from '@nestjs/common';

// OWASP-aligned argon2id params; tuning is a deployment concern, not scattered.
const ARGON2_OPTS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService {
  hash(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTS);
  }

  verify(hashValue: string, plain: string): Promise<boolean> {
    return verify(hashValue, plain, ARGON2_OPTS);
  }
}
