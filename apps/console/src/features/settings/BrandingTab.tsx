import { useEffect, useState } from 'react';
import { FiUploadCloud } from 'react-icons/fi';

import { Badge, Spinner, inputCls } from '../../components/ui';
import { BandCardSkeleton, ConfirmDialog, Sk } from '../../components/kit';
import { api } from '../../lib/api';
import { uploadErrorMessage, uploadFile } from '../../lib/upload';

interface Branding {
  name: string;
  primaryColor: string;
  tagline: string | null;
  logoUrl: string | null;
}

const PRESETS = [
  '#1A4FBF', '#7C3AED', '#0E7490', '#B45309',
  '#BE185D', '#15803D', '#B91C1C', '#374151',
];

export function BrandingTab({
  onFlash,
  onError,
}: {
  onFlash: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [b, setB] = useState<Branding | null>(null);
  // saved color (from API)
  const [color, setColor] = useState('#1A4FBF');
  // staged color — user picked but not yet confirmed
  const [staged, setStaged] = useState<string | null>(null);
  // staged logo file — user picked but not yet confirmed
  const [stagedLogo, setStagedLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get<Branding>('/tenants/me/branding')
      .then((r) => { setB(r.data); setColor(r.data.primaryColor); })
      .catch(() => onError('Could not load branding'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!b) {
    return (
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <BandCardSkeleton title="w-32">
            <div className="p-5">
              <Sk w="w-40" h="h-3" className="mb-2" />
              <Sk w="w-full" h="h-2" className="mb-1" />
              <Sk w="w-4/5" h="h-2" />
              <div className="mt-3 h-32 animate-pulse rounded-[2px] bg-[#E9ECF1]" />
            </div>
          </BandCardSkeleton>
          <BandCardSkeleton title="w-32">
            <div className="p-5">
              <Sk w="w-32" h="h-3" className="mb-2" />
              <div className="mt-3 flex items-center gap-3">
                <Sk w="w-14" h="h-10" />
                <Sk w="w-32" h="h-10" />
              </div>
              <div className="mt-4 flex gap-2">
                {[1,2,3,4,5,6,7,8].map((i) => (
                  <Sk key={i} w="w-8" h="h-8" className="rounded-full" />
                ))}
              </div>
            </div>
          </BandCardSkeleton>
        </div>
        <div>
          <Sk w="w-40" h="h-2.5" className="mb-2" />
          <div className="mx-auto w-[260px] max-w-full rounded-[38px] border-[7px] border-[#0B0F1A] bg-surface p-2.5 shadow-c3">
            <div className="h-[380px] animate-pulse rounded-[31px] bg-[#E9ECF1]" />
          </div>
        </div>
      </div>
    );
  }

  // the color shown in the preview — staged takes priority
  const previewColor = staged ?? color;

  async function applyColor() {
    if (!staged) return;
    const c = staged;
    setBusy(true);
    try {
      const res = await api.patch<Branding>('/tenants/me/branding', { primaryColor: c });
      setB(res.data);
      setColor(c);
      setStaged(null);
      onFlash('Brand color saved — live in the client app immediately');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save color');
    } finally {
      setBusy(false);
    }
  }

  async function applyLogo() {
    if (!stagedLogo) return;
    setBusy(true);
    try {
      const fileId = await uploadFile(stagedLogo, 'tenant_logo');
      const res = await api.patch<Branding>('/tenants/me/branding', { logoFileId: fileId });
      setB(res.data);
      setStagedLogo(null);
      onFlash('Logo updated — live in the client app immediately');
    } catch (e) {
      onError(uploadErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        {/* ── controls ── */}
        <div className="space-y-3">

          {/* logo upload */}
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <div className="band"><span className="t">Business Logo</span></div>
            <div className="p-4">
              <p className="mb-3 text-[11.5px] text-ink-muted">
                Shown on loan cards, payment screens and invite flow in the client app.
                Square PNG or JPG, ≥ 256×256 recommended.
              </p>
              <label className="flex cursor-pointer flex-col items-center rounded-[3px] border-[1.5px] border-dashed border-brand-100 bg-brand-50 px-4 py-6 text-center transition-colors hover:border-brand-500">
                {busy && stagedLogo ? <Spinner /> : (
                  <>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600/10 text-brand-600">
                      <FiUploadCloud size={18} />
                    </span>
                    <b className="mt-2 text-[12.5px] text-ink">
                      {stagedLogo ? stagedLogo.name : b.logoUrl ? 'Replace logo' : 'Upload logo'}
                    </b>
                    <span className="text-[10.5px] text-ink-muted">PNG or JPG · max 5MB</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setStagedLogo(f);
                    e.target.value = '';
                  }}
                />
              </label>
              {stagedLogo && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10.5px] text-ink-muted">
                    Ready to upload: <b className="text-ink">{stagedLogo.name}</b>
                  </span>
                  <button
                    onClick={() => setStagedLogo(null)}
                    className="ml-auto text-[10.5px] text-ink-muted hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* brand color */}
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <div className="band"><span className="t">Brand Color</span></div>
            <div className="p-4">
              <p className="mb-3 text-[11.5px] text-ink-muted">
                Used for your surfaces in the app. Status colors (overdue = red, paid = green)
                stay standardized for clarity.
              </p>

              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(previewColor) ? previewColor : '#1A4FBF'}
                  onChange={(e) => setStaged(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-[3px] border border-line bg-white p-1"
                />
                <input
                  className={`${inputCls} w-32 font-mono text-[12.5px]`}
                  value={previewColor}
                  onChange={(e) => setStaged(e.target.value)}
                />
                {staged && staged !== color && (
                  <button
                    onClick={() => setStaged(null)}
                    className="text-[10.5px] text-ink-muted hover:text-ink"
                  >
                    Reset
                  </button>
                )}
              </div>

              {staged && staged !== color && (
                <p className="mt-2 text-[10.5px] text-amber-600">
                  Preview updated — click <b>Apply color</b> to save to the client app.
                </p>
              )}

              <div className="mt-3">
                <div className="mb-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
                  Quick presets
                </div>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setStaged(p)}
                      className={`h-7 w-7 rounded-[3px] border-2 transition-transform hover:scale-110 ${
                        previewColor === p ? 'border-ink' : 'border-transparent'
                      }`}
                      style={{ background: p }}
                      title={p}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* what clients see */}
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <div className="band"><span className="t">What Clients See</span></div>
            <div className="p-4">
              <ul className="space-y-1.5 text-[12px] text-ink-2">
                <li className="flex items-center gap-2">
                  <Badge color="green" dot>Branded</Badge>
                  loan cards, loan detail header, payment sheet, invite screens
                </li>
                <li className="flex items-center gap-2">
                  <Badge color="blue" dot>Kumvwa</Badge>
                  app navigation, profile, alerts — trust chrome stays Kumvwa
                </li>
                <li className="flex items-center gap-2">
                  <Badge color="grey" dot>Fixed</Badge>
                  status colors (paid/overdue) — regulatory clarity for everyone
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── live preview ── */}
        <div className="lg:sticky lg:top-6">
          <div className="mb-2 text-center text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
            Live preview — client app
          </div>
          <PreviewCard branding={{ ...b, primaryColor: previewColor }} />
        </div>
      </div>

      {/* ── color confirm ── */}
      <ConfirmDialog
        open={!!staged && staged !== color && !stagedLogo}
        onClose={() => setStaged(null)}
        onConfirm={applyColor}
        title="Apply brand color?"
        body={`This will set your brand color to ${staged ?? ''} and go live in the client app immediately for all your borrowers. You can change it again at any time.`}
        confirmLabel={busy ? 'Saving…' : 'Apply color'}
        busy={busy}
      />

      {/* ── logo confirm ── */}
      <ConfirmDialog
        open={!!stagedLogo && !staged}
        onClose={() => setStagedLogo(null)}
        onConfirm={applyLogo}
        title="Upload new logo?"
        body={`"${stagedLogo?.name ?? ''}" will replace your current logo and go live in the client app immediately for all your borrowers.`}
        confirmLabel={busy ? 'Uploading…' : 'Upload logo'}
        busy={busy}
      />
    </>
  );
}

// ── Preview card ──────────────────────────────────────────────────────────────

export function PreviewCard({ branding }: { branding: Branding }) {
  const c = branding.primaryColor;
  return (
        <div className="mx-auto w-[260px] max-w-full rounded-[38px] border-[7px] border-[#0B0F1A] bg-surface shadow-c3">
      <div className="overflow-hidden rounded-[31px]">
        <div className="flex items-center justify-between bg-white px-4 pb-1 pt-2.5 text-[9px] font-bold text-ink">
          <span>09:41</span>
          <span>▮▮▮ ⌁ ▉</span>
        </div>
        <div className="space-y-2.5 p-3">
          <div
            className="rounded-2xl p-3.5 text-white"
            style={{ background: `linear-gradient(135deg, ${c}, ${shade(c, -35)})` }}
          >
            <div className="flex items-center gap-2">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-[9px] font-extrabold">
                  {initials(branding.name)}
                </div>
              )}
              <span className="text-[10.5px] font-bold">{branding.name}</span>
            </div>
            <div className="mt-2 font-display text-[18px] font-extrabold">K 850.00</div>
            <div className="text-[9px] opacity-80">Next payment · due 12 Aug</div>
            <div
              className="mt-2.5 rounded-lg bg-white/95 py-1.5 text-center text-[10px] font-extrabold"
              style={{ color: c }}
            >
              Pay Now
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-3">
            <div className="text-[9px] font-bold text-ink-muted">ALL MY LOANS</div>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full" style={{ background: c }} />
              <div className="flex-1">
                <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
                <div className="mt-1 h-1.5 w-1/2 rounded-full bg-gray-100" />
              </div>
              <span className="rounded-full bg-accent-50 px-1.5 py-0.5 text-[7.5px] font-extrabold text-accent-700">
                Active
              </span>
            </div>
          </div>
          <div className="flex justify-around rounded-2xl border border-line bg-white py-2 text-[7px] font-bold text-ink-muted">
            <span>🏠 Home</span>
            <span>🔔 Alerts</span>
            <span>👤 Profile</span>
          </div>
          {branding.tagline && (
            <div className="pb-1 text-center text-[8px] text-ink-muted">{branding.tagline}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + Math.round(2.55 * amt));
  const g = clamp(((n >> 8) & 0xff) + Math.round(2.55 * amt));
  const bv = clamp((n & 0xff) + Math.round(2.55 * amt));
  return `#${((r << 16) | (g << 8) | bv).toString(16).padStart(6, '0')}`;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p.at(-1)?.[0] ?? '')).toUpperCase();
}
