import { api, apiError } from './api';

export async function uploadFile(
  file: File,
  kind: 'boz_certificate' | 'tenant_logo' | 'nrc_photo' | 'kyc_document',
): Promise<string> {
  const mime = file.type || 'application/octet-stream';
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File exceeds the 5MB limit');
  }
  const up = await api.post<{
    fileId: string;
    uploadUrl: string;
    headers: { 'Content-Type': string };
  }>('/files/upload-url', { kind, mime, size: file.size });
  const put = await fetch(up.data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: file,
  });
  if (!put.ok) throw new Error('Upload to storage failed');
  await api.post(`/files/${up.data.fileId}/confirm`);
  return up.data.fileId;
}

export function uploadErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : apiError(e);
}
