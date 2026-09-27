import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AllowUnverifiedTenant } from '../../common/guards/unverified-tenant.decorator';
import { CreateUploadUrlDto } from './dto/files.dto';
import { FilesService } from './files.service';

@Roles('tenant_owner', 'tenant_staff')
@Controller('files')
@AllowUnverifiedTenant()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  uploadUrl(@CurrentUser() u: TokenClaims, @Body() dto: CreateUploadUrlDto) {
    return this.files.createUploadUrl(u.tenantId!, u.sub, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.confirm(u.tenantId!, u.sub, id);
  }
}

/**
 * Split out so `platform_admin` can open a lender's certificate from the
 * verification queue — admins have no `tenantId` of their own.
 */
/**
 * Borrower self-service uploads. Clients have no `tenantId`, so their files
 * are created tenant-less under the `clients/` storage prefix. Only an NRC
 * photo may be uploaded — the plainer KYC document kinds stay lender-side.
 */
@Roles('client')
@Controller('files/client')
export class ClientFilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  uploadUrl(@CurrentUser() u: TokenClaims, @Body() dto: CreateUploadUrlDto) {
    if (dto.kind !== 'nrc_photo') {
      throw new BadRequestException('Clients may only upload NRC photos');
    }
    return this.files.createUploadUrl(null, u.sub, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.confirm(null, u.sub, id);
  }
}

@Roles('tenant_owner', 'tenant_staff', 'platform_admin')
@Controller('files')
export class FilesDownloadController {
  constructor(private readonly files: FilesService) {}

  @Get(':id/download-url')
  downloadUrl(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.downloadUrl(u, id);
  }
}
