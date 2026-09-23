import { Module } from '@nestjs/common';

import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PasswordService } from '../../common/crypto/password.service';
import { TokenService } from '../../common/crypto/token.service';
import { AuditModule } from '../audit/audit.module';
import { TermsModule } from '../terms/terms.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [AuditModule, TermsModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, NrcCryptoService],
  // NrcCryptoService is exported for the verification/compliance modules,
  // which decrypt tenant-owner NRCs under audit.
  exports: [TokenService, PasswordService, NrcCryptoService],
})
export class AuthModule {}
