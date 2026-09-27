/**
 * Zambian NRC — `245711/63/1`. Platform reviewers check this exact number
 * against the BOZ certificate, so the console validates the same shape the API
 * enforces in `SubmitVerificationDto.ownerNrc`.
 */
export const NRC_RE = /^\d{6}\/\d{2}\/\d$/;

/** Inserts the separators as the owner types (digits only, max 9). */
export function formatNrc(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 9);
  return [d.slice(0, 6), d.slice(6, 8), d.slice(8, 9)]
    .filter(Boolean)
    .join('/');
}

/** Empty string when valid — drops straight into a field-error slot. */
export function nrcError(value: string): string {
  if (!value.trim()) return 'Owner NRC is required';
  return NRC_RE.test(value)
    ? ''
    : 'Nine digits as three groups, e.g. 245711/63/1';
}
