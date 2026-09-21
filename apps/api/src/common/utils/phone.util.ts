const ZM_MOBILE = /^[5-9]\d{8}$/; // 9 digits after country code

/**
 * Normalizes Zambian phone input to E.164 (+260…).
 * Accepts: 0971234567 · +260971234567 · 260971234567 · 971234567.
 * Returns null when the input can't be a Zambian mobile number.
 */
export function normalizeZmPhone(raw: string): string | null {
  const d = raw.replace(/[\s\-()]/g, '');
  let n: string | null = null;
  if (/^\+260[5-9]\d{8}$/.test(d)) n = d.slice(1);
  else if (/^260[5-9]\d{8}$/.test(d)) n = d;
  else if (/^0[5-9]\d{8}$/.test(d)) n = `260${d.slice(1)}`;
  else if (ZM_MOBILE.test(d)) n = `260${d}`;
  return n ? `+${n}` : null;
}
