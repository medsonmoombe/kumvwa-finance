import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { File as FileRow } from '@prisma/client';

import type { TokenClaims } from '../../common/crypto/token.service';
import { PrismaService } from '../../infra/prisma.module';
import { AuditService } from '../audit/audit.service';
import { StorageService, PRESIGN_TTL_SEC } from './storage.service';
import type { CreateUploadUrlDto, FileKindName } from './dto/files.dto';

/** Per-kind MIME allow-list — a logo is never a PDF, an NRC photo never a PDF. */
export const ALLOWED_MIMES_BY_KIND: Record<FileKindName, readonly string[]> = {
  boz_certificate: ['application/pdf', 'image/jpeg', 'image/png'],
  kyc_document: ['application/pdf', 'image/jpeg', 'image/png'],
  nrc_photo: ['image/jpeg', 'image/png'],
  tenant_logo: ['image/png', 'image/jpeg'],
  other: ['application/pdf', 'image/jpeg', 'image/png'],
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Presigned GET for a stored object — branding everywhere reuses this. */
  presignGet(storageKey: string, mime?: string): Promise<string> {
    return this.storage.presignGet(storageKey, mime);
  }

  /**
   * Step 1 of 3. The row is reserved *now* rather than at confirm so the
   * client gets a stable `fileId` to confirm against. `checksum` stays empty
   * until the object's ETag is known.
   */
  async createUploadUrl(
    tenantId: string | null,
    actorId: string,
    dto: CreateUploadUrlDto,
  ) {
    const allowed = ALLOWED_MIMES_BY_KIND[dto.kind];
    if (!allowed.includes(dto.mime)) {
      throw new BadRequestException(
        `${dto.mime} is not an accepted type for ${dto.kind}`,
      );
    }

    // Clients (invite/KYC uploads) have no tenant yet — their objects land
    // under a shared `clients/` prefix; everything else stays tenant-scoped.
    const storageKey =
      tenantId === null
        ? `clients/${dto.kind}/${randomUUID()}`
        : `tenants/${tenantId}/${dto.kind}/${randomUUID()}`;

    const file = await this.prisma.file.create({
      data: {
        tenantId,
        kind: dto.kind,
        storageKey,
        mime: dto.mime,
        size: dto.size,
        checksum: '',
      },
    });

    const uploadUrl = await this.storage.presignPut(storageKey, dto.mime);

    await this.audit.record({
      actorId,
      action: 'file.upload_url',
      entity: 'File',
      entityId: file.id,
      tenantId: tenantId ?? undefined,
      diff: { kind: dto.kind, mime: dto.mime, size: dto.size },
    });

    return {
      fileId: file.id,
      uploadUrl,
      storageKey,
      expiresInSec: PRESIGN_TTL_SEC,
    };
  }

  /** Step 2 of 3: prove the bytes actually landed before trusting the row. */
  async confirm(tenantId: string | null, actorId: string, fileId: string) {
    const file = await this.mustOwn(tenantId, fileId);

    const head = await this.storage.head(file.storageKey);
    if (!head) {
      throw new BadRequestException(
        'Upload not found in storage — PUT the file before confirming',
      );
    }

    const updated = await this.prisma.file.update({
      where: { id: file.id },
      data: { checksum: head.etag, size: head.size },
    });

    await this.audit.record({
      actorId,
      action: 'file.confirm',
      entity: 'File',
      entityId: updated.id,
      tenantId: tenantId ?? undefined,
      diff: { checksum: updated.checksum, size: updated.size },
    });

    return {
      id: updated.id,
      kind: updated.kind,
      mime: updated.mime,
      size: updated.size,
      status: 'ready' as const,
    };
  }

  /**
   * Re-checks storage for an already-confirmed row. `confirm()` proves the
   * bytes landed once; this catches objects deleted afterwards (bucket reset,
   * lifecycle rule, manual cleanup) so a submission never points at nothing.
   */
  async assertObjectPresent(storageKey: string): Promise<void> {
    const head = await this.storage.head(storageKey);
    if (!head) {
      throw new BadRequestException(
        'The certificate is no longer in storage — upload it again before submitting',
      );
    }
  }

  /**
   * Step 3 of 3. Admins review any tenant's certificate; everyone else is
   * scoped to their own. Reading a BOZ certificate is a PII read → audited.
   */
  async downloadUrl(claims: TokenClaims, fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundException('File not found');

    const isAdmin = claims.role === 'platform_admin';
    if (!isAdmin && file.tenantId !== claims.tenantId) {
      throw new NotFoundException('File not found');
    }

    const downloadUrl = await this.storage.presignGet(file.storageKey, file.mime);

    await this.audit.record({
      actorId: claims.sub,
      action: 'file.download_url',
      entity: 'File',
      entityId: file.id,
      tenantId: file.tenantId ?? undefined,
      diff: { kind: file.kind, asAdmin: isAdmin },
    });

    return {
      downloadUrl,
      mime: file.mime,
      size: file.size,
      expiresInSec: PRESIGN_TTL_SEC,
    };
  }

  /** 404 (never 403) so file ids can't be probed across tenants. */
  private async mustOwn(
    tenantId: string | null,
    fileId: string,
  ): Promise<FileRow> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.tenantId !== tenantId) {
      throw new NotFoundException('File not found');
    }
    // Client uploads carry no tenant — they may only ever be NRC photos.
    if (tenantId === null && file.kind !== 'nrc_photo') {
      throw new NotFoundException('File not found');
    }
    return file;
  }
}
