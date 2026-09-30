import { Module } from '@nestjs/common';

import { EmailService } from '../../common/email/email.service';
import { NrcCryptoService } from '../../common/crypto/nrc-crypto.service';
import { PasswordService } from '../../common/crypto/password.service';
import { TokenService } from '../../common/crypto/token.service';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../admin/platform.module';
import { TermsModule } from '../terms/terms.module';
import { FilesModule } from '../files/files.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [AuditModule, TermsModule, PlatformModule, FilesModule],
  controllers: [AuthController],
  providers: [AuthService, EmailService, PasswordService, TokenService, NrcCryptoService],
  // NrcCryptoService is exported for the verification/compliance modules,
  // which decrypt tenant-owner NRCs under audit.
  exports: [AuthService, TokenService, PasswordService, NrcCryptoService],
})
export class AuthModule {}
