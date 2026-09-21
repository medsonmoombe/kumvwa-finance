import { randomUUID } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '@prisma/client';

import { ENV, type Env } from '../../config/env';

export type TokenType = 'access' | 'refresh' | 'otp';

export interface TokenClaims {
  sub: string;
  role?: UserRole;
  tenantId?: string | null;
  clientId?: string | null;
  typ: TokenType;
  purpose?: string; // otp only
  phone?: string; // otp only
  jti: string;
}

@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshKey: Uint8Array;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    this.refreshKey = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  }

  async signAccessToken(u: {
    id: string;
    role: UserRole;
    tenantId?: string | null;
    clientId?: string | null;
  }): Promise<string> {
    return this.sign(
      {
        sub: u.id,
        role: u.role,
        tenantId: u.tenantId,
        clientId: u.clientId,
        typ: 'access',
      },
      this.accessKey,
      `${this.env.ACCESS_TOKEN_TTL_MIN}m`,
    );
  }

  async signRefreshToken(
    u: {
      id: string;
      role: UserRole;
      tenantId?: string | null;
      clientId?: string | null;
    },
    jti: string,
  ): Promise<string> {
    return this.sign(
      {
        sub: u.id,
        role: u.role,
        tenantId: u.tenantId,
        clientId: u.clientId,
        typ: 'refresh',
        jti,
      },
      this.refreshKey,
      `${this.env.REFRESH_TOKEN_TTL_DAYS}d`,
    );
  }

  async signOtpToken(phone: string, purpose: string, jti: string): Promise<string> {
    return this.sign(
      { sub: phone, typ: 'otp', purpose, phone, jti },
      this.accessKey,
      `${this.env.OTP_TTL_MIN}m`,
    );
  }

  async verify(token: string, expected: TokenType): Promise<TokenClaims> {
    const key = expected === 'refresh' ? this.refreshKey : this.accessKey;
    try {
      const { payload } = await jwtVerify(token, key);
      const claims = payload as unknown as TokenClaims;
      if (claims.typ !== expected) throw new Error('wrong token type');
      return claims;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async sign(
    claims: Record<string, unknown>,
    key: Uint8Array,
    ttl: string,
  ): Promise<string> {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setJti((claims['jti'] as string) ?? randomUUID())
      .setExpirationTime(ttl)
      .sign(key);
  }
}
