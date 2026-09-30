import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { TokenClaims } from '../../common/crypto/token.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/guards/public.decorator';
import { Roles } from '../../common/guards/roles.decorator';
import { AllowUnverifiedTenant } from '../../common/guards/unverified-tenant.decorator';
import {
  CreateUploadUrlDto,
  LocalStorageParamDto,
  MAX_UPLOAD_BYTES,
} from './dto/files.dto';
import { FilesService } from './files.service';
import type { LocalStorageDriver } from './storage/local-storage.driver';
import { StorageService } from './storage.service';

/** Only these types may be served inline from local storage (no HTML/JS). */
const RENDERABLE_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

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

  @Post('profile-image/:id')
  setProfileImage(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.setProfileImage(u.sub, id);
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
    if (!['nrc_photo', 'profile_image'].includes(dto.kind)) {
      throw new BadRequestException(
        'Clients may only upload NRC photos or a profile image',
      );
    }
    return this.files.createUploadUrl(null, u.sub, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.confirm(null, u.sub, id);
  }

  @Post('profile-image/:id')
  setProfileImage(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.setProfileImage(u.sub, id);
  }
}

@Roles('platform_admin')
@Controller('files/platform')
export class PlatformProfileFilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  uploadUrl(@CurrentUser() u: TokenClaims, @Body() dto: CreateUploadUrlDto) {
    if (dto.kind !== 'profile_image') {
      throw new BadRequestException('Only a profile image can be uploaded here');
    }
    return this.files.createUploadUrl(null, u.sub, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.confirm(null, u.sub, id);
  }

  @Post('profile-image/:id')
  setProfileImage(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.setProfileImage(u.sub, id);
  }
}

@Roles('tenant_owner', 'tenant_staff', 'platform_admin')
// A pending/rejected lender must still be able to open their own certificate
// from /verify — `downloadUrl` scopes by tenantId, so nothing leaks.
@AllowUnverifiedTenant()
@Controller('files')
export class FilesDownloadController {
  constructor(private readonly files: FilesService) {}

  @Get(':id/download-url')
  downloadUrl(@CurrentUser() u: TokenClaims, @Param('id') id: string) {
    return this.files.downloadUrl(u, id);
  }
}

/**
 * The `STORAGE_DRIVER=local` backend's equivalent of S3 pre-signed URLs.
 * Auth lives entirely in the signed `key`/`expires`/`sig` query parameters
 * (same trust model as a pre-signed URL), so these routes are `@Public()` and
 * the browser can PUT bytes here — or fetch them back — with no Bearer token,
 * exactly as it would talk to MinIO/S3. Flip `STORAGE_DRIVER=s3` and these two
 * routes simply stop being minted.
 */
@Public()
@Controller('files')
export class LocalStorageController {
  constructor(private readonly storage: StorageService) {}

  /** Raw PUT: streams the body straight into `docs/<key>`. */
  @Put('local-storage/upload')
  async upload(
    @Query() query: LocalStorageParamDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const driver = this.mustLocal();
    this.mustVerify(driver, 'put', query);

    const object = await driver.saveStream(query.key, req, MAX_UPLOAD_BYTES);
    res.setHeader('ETag', `"${object.etag}"`);
    res.status(200).json({ ok: true, size: object.size });
  }

  /** Raw GET: streams `docs/<key>` back with its document content type. */
  @Get('local-storage/download')
  async download(@Query() query: LocalStorageParamDto, @Res() res: Response) {
    const driver = this.mustLocal();
    this.mustVerify(driver, 'get', query);

    const file = await driver.getStream(query.key);
    if (!file) throw new NotFoundException('File not found in storage');

    // Never let an uploaded document be interpreted as HTML/JS by the browser.
    const mime = RENDERABLE_MIMES.includes(query.mime ?? '')
      ? query.mime!
      : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', file.size);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Inline so a certificate opens in the tab instead of forcing a download.
    res.setHeader(
      'Content-Disposition',
      mime === 'application/octet-stream' ? 'attachment' : 'inline',
    );
    file.stream.pipe(res);
  }

  private mustLocal() {
    const driver = this.storage.getLocalDriver();
    if (!driver) {
      throw new NotFoundException(
        'Local storage is not active — set STORAGE_DRIVER=local',
      );
    }
    return driver;
  }

  private mustVerify(
    driver: LocalStorageDriver,
    action: 'put' | 'get',
    query: LocalStorageParamDto,
  ) {
    const expires = Number.parseInt(query.expires, 10);
    if (!Number.isFinite(expires)) {
      throw new BadRequestException('Invalid expiry timestamp');
    }
    const valid = driver.verifySignature(action, {
      key: query.key,
      mime: query.mime,
      expires,
      sig: query.sig,
    });
    if (!valid) {
      throw new ForbiddenException('Invalid or expired storage signature');
    }
  }
}
