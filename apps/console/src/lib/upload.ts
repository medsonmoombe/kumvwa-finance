import { api, apiError } from './api';

export type UploadKind =
  | 'boz_certificate'
  | 'tenant_logo'
  | 'nrc_photo'
  | 'kyc_document';

/** Console-side cap shown to the user; the API enforces its own ceiling too. */
export const MAX_UPLOAD_MB = 5;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

/**
 * Client-side guard so an obviously bad pick is refused before it reaches
 * storage: wrong size, wrong type, or an empty file.
 */
export function assertUploadable(file: File): void {
  if (file.size === 0) {
    throw new Error(`“${file.name}” is empty. Pick the document again.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `“${file.name}” is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB.`,
    );
  }
  if (file.type && !ALLOWED_MIMES.includes(file.type)) {
    throw new Error(
      `“${file.name}” is a ${file.type} file. Attach a PDF, JPG or PNG.`,
    );
  }
}

/** Names the storage host so a "upload failed" message is actionable. */
function storageHint(uploadUrl: string): string {
  try {
    return new URL(uploadUrl).host;
  } catch {
    return 'the configured S3/MinIO endpoint';
  }
}

/**
 * Presign → PUT → confirm. The PUT goes straight to storage (the API never
 * proxies PII bytes), so its failures are network-level: say so, and say
 * nothing was saved, instead of bubbling an opaque "failed to fetch".
 */
export async function uploadFile(file: File, kind: UploadKind): Promise<string> {
  assertUploadable(file);
  const mime = file.type || 'application/pdf';
  const up = await api.post<{
    fileId: string;
    uploadUrl: string;
    headers: { 'Content-Type': string };
  }>('/files/upload-url', { kind, mime, size: file.size });

  let put: Response;
  try {
    put = await fetch(up.data.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: file,
    });
  } catch {
    throw new Error(
      `Could not reach file storage (${storageHint(up.data.uploadUrl)}). Nothing was saved — start the storage service and try again.`,
    );
  }
  if (!put.ok) {
    throw new Error(
      `File storage rejected the upload (${put.status} ${put.statusText}). Nothing was saved — try again.`,
    );
  }

  await api.post(`/files/${up.data.fileId}/confirm`);
  return up.data.fileId;
}

export function uploadErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : apiError(e);
}
