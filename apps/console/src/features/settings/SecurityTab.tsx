import { useEffect, useState } from 'react';
import { FiKey, FiMonitor, FiShield } from 'react-icons/fi';

import { ErrorBox } from '../../components/ui';
import { ConfirmDialog, Pill, Sk } from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface Device {
  id: string; label: string | null; createdAt: string; expiresAt: string;
}

export function SecurityTab({
  onFlash, onError,
}: {
  onFlash: (m: string) => void; onError: (m: string) => void;
}) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [twoFa, setTwoFa] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<Device | null>(null);
  const [busy, setBusy] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [mobileCode, setMobileCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  useEffect(() => {
    api.get<Device[]>('/auth/devices')
      .then((r) => setDevices(r.data))
      .catch(() => setError('Could not load trusted devices'));
    api.get<{ twoFactorEnabled: boolean }>('/auth/2fa')
      .then((r) => setTwoFa(r.data.twoFactorEnabled))
      .catch(() => {});
  }, []);

  async function toggle2fa() {
    if (twoFa === null) return;
    setToggling(true); setError('');
    try {
      const res = await api.patch<{ twoFactorEnabled: boolean }>('/auth/2fa', { enabled: !twoFa });
      setTwoFa(res.data.twoFactorEnabled);
      onFlash(res.data.twoFactorEnabled
        ? 'Two-factor authentication enabled — a code will be required on every new device sign-in'
        : 'Two-factor authentication disabled — sign-ins will only require your password');
    } catch (e) {
      const msg = apiError(e);
      setError(msg); onError(msg);
    } finally { setToggling(false); }
  }

  async function revoke() {
    if (!revoking) return;
    setBusy(true); setError('');
    try {
      await api.delete(`/auth/devices/${revoking.id}`);
      setDevices((rows) => rows?.filter((d) => d.id !== revoking.id) ?? null);
      onFlash('Device revoked — it will require a code at next sign-in');
    } catch (e) {
      const msg = apiError(e);
      setError(msg); onError(msg);
    } finally {
      setBusy(false); setRevoking(null);
    }
  }

  async function generateMobileCode() {
    setGeneratingCode(true); setError('');
    try {
      const res = await api.post<{ code: string; expiresAt: string }>('/auth/mobile/lender/access-code');
      setMobileCode(res.data);
      onFlash('One-time mobile access code created');
    } catch (e) {
      const msg = apiError(e); setError(msg); onError(msg);
    } finally { setGeneratingCode(false); }
  }

  return (
    <>
      {/* ── 2FA toggle ── */}
      <div className="mb-4 overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
            Two-Factor Authentication
          </span>
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2">
            <FiShield size={18} />
          </div>
          <div className="min-w-0 flex-1">
            {twoFa === null ? (
              <Sk w="w-48" h="h-3" />
            ) : (
              <>
                <b className="block text-[13px] font-semibold text-ink">
                  2FA is currently{' '}
                  <span className={twoFa ? 'text-accent-700' : 'text-red-600'}>
                    {twoFa ? 'enabled' : 'disabled'}
                  </span>
                </b>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {twoFa
                    ? 'A one-time code is emailed on every sign-in from an unrecognised device.'
                    : 'Anyone with your password can sign in. Enable 2FA to protect your loan book.'}
                </p>
              </>
            )}
          </div>
          <Pill
            tone={twoFa ? 'danger' : 'primary'}
            onClick={toggle2fa}
            disabled={toggling || twoFa === null}
          >
            {toggling ? 'Saving…' : twoFa ? 'Disable 2FA' : 'Enable 2FA'}
          </Pill>
        </div>
        {!twoFa && twoFa !== null && (
          <div className="border-t border-line bg-red-50 px-4 py-2.5 text-[11px] font-semibold text-red-700">
            ⚠ Two-factor authentication is off. Your account is protected by password only.
          </div>
        )}
      </div>

      {/* ── trusted devices ── */}
      <div className="mb-4 overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">Mobile Access Code</span>
        </div>
        <div className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2"><FiKey size={18} /></div>
          <div className="min-w-0 flex-1"><b className="block text-[13px] font-semibold text-ink">Sign in without email delivery</b><p className="mt-0.5 text-[11px] text-ink-muted">Create a high-entropy code for your own lender app sign-in. It expires in 10 minutes and works once.</p></div>
          <Pill tone="primary" onClick={generateMobileCode} disabled={generatingCode}>{generatingCode ? 'Creating...' : 'Generate code'}</Pill>
        </div>
        {mobileCode && <div className="border-t border-line bg-surface px-4 py-3"><div className="font-mono text-[16px] font-bold tracking-[0.08em] text-ink">{mobileCode.code}</div><p className="mt-1 text-[10.5px] text-ink-muted">Share it directly with the account holder. It expires {date(mobileCode.expiresAt)} and is never shown again.</p></div>}
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
            Trusted Devices
          </span>
          <span className="text-[10px] text-ink-muted">Skips 2FA for 30 days</span>
        </div>

        {error && <div className="p-3"><ErrorBox message={error} /></div>}

        {!devices ? (
          <div className="divide-y divide-line-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-[3px] bg-[#E9ECF1]" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Sk w="w-40" h="h-2.5" />
                  <Sk w="w-52" h="h-2" />
                </div>
                <Sk w="w-16" h="h-7" className="shrink-0" />
              </div>
            ))}
          </div>
        ) : devices.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12.5px] text-ink-muted">
            No trusted devices. Sign in with "Remember this device" to add one.
          </p>
        ) : (
          <div>
            {devices.map((d) => (
              <div key={d.id} className="flex items-center gap-3 border-b border-line-2 px-4 py-3 last:border-none">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-line bg-surface text-ink-2">
                  <FiMonitor size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[12.5px] font-semibold">
                    {d.label ?? 'Unknown device'}
                  </b>
                  <span className="text-[10.5px] text-ink-muted">
                    Added {date(d.createdAt)} · expires {date(d.expiresAt)}
                  </span>
                </div>
                <Pill tone="danger" onClick={() => setRevoking(d)}>Revoke</Pill>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke trusted device?"
        body={`"${revoking?.label ?? 'This device'}" will need to verify with an emailed code at its next sign-in. This takes effect immediately.`}
        confirmLabel="Revoke device"
        danger
        busy={busy}
      />
    </>
  );
}
