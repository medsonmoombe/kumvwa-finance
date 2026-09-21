import { Module } from '@nestjs/common';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PasswordService } from '../../common/crypto/password.service';
import { TokenService } from '../../common/crypto/token.service';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, NrcCryptoService],
  exports: [TokenService, PasswordService],
})
export class AuthModule {}
