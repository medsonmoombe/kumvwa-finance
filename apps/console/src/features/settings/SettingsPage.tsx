import { useEffect, useState } from 'react';
import { FiCheck, FiCreditCard, FiFileText, FiInfo, FiLock, FiShield, FiUploadCloud } from 'react-icons/fi';

import { ErrorBox, inputCls, labelCls } from '../../components/ui';
import { PageActionBar, Pill } from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { BillingTab } from './BillingTab';
import { BrandingTab } from './BrandingTab';
import { PolicyTab } from './PolicyTab';
import { TermsTab } from './TermsTab';
import { SecurityTab } from './SecurityTab';

type Tab = 'business' | 'branding' | 'terms' | 'policy' | 'billing' | 'security';

const TABS: readonly Tab[] = [
  'business',
  'branding',
  'terms',
  'policy',
  'billing',
  'security',
];

/** `?tab=billing` so the capacity banner can deep-link straight to buying slots. */
function tabFromQuery(): Tab {
  const q = new URLSearchParams(window.location.search).get('tab');
  return TABS.includes(q as Tab) ? (q as Tab) : 'business';
}

export function SettingsPage() {
  const { tenant, refreshSession } = useAuth();
  const [tab, setTab] = useState<Tab>(tabFromQuery);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const [form, setForm] = useState({
    email: '', address: '', tpin: '', contactPerson: '', businessDescription: '', tagline: '',
  });

  useEffect(() => {
    api.get('/tenants/me/branding')
      .then((r: { data: { email?: string | null; address?: string | null; tpin?: string | null; contactPerson?: string | null; businessDescription?: string | null; tagline?: string | null } }) => {
        setForm({
          email: r.data.email ?? '',
          address: r.data.address ?? '',
          tpin: r.data.tpin ?? '',
          contactPerson: r.data.contactPerson ?? '',
          businessDescription: r.data.businessDescription ?? '',
          tagline: r.data.tagline ?? '',
        });
      })
      .catch(() => {});
  }, []);

  if (!tenant) return null;

  async function saveBusiness() {
    setSaving(true); setError(''); setOk('');
    try {
      await api.patch('/tenants/me/branding', form);
      await refreshSession();
      setOk('Business details saved');
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageActionBar
        title="Settings"
        sub={`${tenant.name} · branding, terms and business details`}
      />

      <div className="mb-4 flex gap-0 border-b border-line">
        {([
          ['business', 'Business', <FiInfo key="a" size={12} />],
          ['branding', 'App Branding', <FiUploadCloud key="b" size={12} />],
          ['terms', 'Lending Terms', <FiFileText key="c" size={12} />],
          ['policy', 'Lending Rules', <FiShield key="d" size={12} />],
          ['billing', 'Billing', <FiCreditCard key="f" size={12} />],
          ['security', 'Security', <FiLock key="e" size={12} />],
        ] as Array<[Tab, string, React.ReactNode]>).map(([id, lbl, icon]) => (
          <button key={id} onClick={() => {
            setTab(id);
            setOk('');
            setError('');
            // Keep the URL in step so a deep link survives a reload and so the
            // browser Back button returns to the tab the user came from.
            window.history.replaceState(
              null,
              '',
              id === 'business' ? '/settings' : `/settings?tab=${id}`,
            );
          }}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 pb-2.5 pt-1 text-[11.5px] font-bold transition-colors ${
              tab === id ? 'border-brand-500 text-brand-600' : 'border-transparent text-ink-muted hover:text-ink'
            }`}>
            {icon} {lbl}
          </button>
        ))}
      </div>

      {ok && (
        <div className="mb-4 flex items-center gap-2 rounded-[3px] border border-emerald-200 bg-accent-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-accent-700">
          <FiCheck /> {ok}
        </div>
      )}
      {error && <div className="mb-4"><ErrorBox message={error} /></div>}

      {tab === 'business' && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="band"><span className="t">Business Details</span></div>
          <div className="p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Business email</label>
                <input className={inputCls} value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="info@yourbusiness.zm" />
              </div>
              <div>
                <label className={labelCls}>Contact person</label>
                <input className={inputCls} value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  placeholder="Full name" />
              </div>
              <div>
                <label className={labelCls}>Business address</label>
                <input className={inputCls} value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Plot, street, city" />
              </div>
              <div>
                <label className={labelCls}>TPIN (optional)</label>
                <input className={inputCls} value={form.tpin}
                  onChange={(e) => setForm({ ...form, tpin: e.target.value })}
                  placeholder="Tax number" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Business description</label>
                <textarea className={[inputCls, 'min-h-20 resize-y'].join(' ')} value={form.businessDescription}
                  onChange={(e) => setForm({ ...form, businessDescription: e.target.value.slice(0, 1000) })}
                  placeholder="Describe your lending business, clients served, and loan products." />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Tagline (shows under your name in the client app)</label>
                <input className={inputCls} value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="e.g. Community lending, done right" />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Pill onClick={saveBusiness} disabled={saving}>
                {saving ? 'Saving…' : 'Save Business Details'}
              </Pill>
            </div>
            <p className="mt-3 text-[11px] text-ink-muted">
              Your email is the address we use for platform notifications.
              Client-facing communication is sent from Kumvwa on your behalf.
            </p>
          </div>
        </div>
      )}

      {tab === 'branding' && <BrandingTab onFlash={setOk} onError={setError} />}
      {tab === 'terms' && <TermsTab onFlash={setOk} />}
      {tab === 'policy' && <PolicyTab onFlash={setOk} onError={setError} />}
      {tab === 'billing' && <BillingTab onFlash={setOk} onError={setError} />}
      {tab === 'security' && <SecurityTab onFlash={setOk} onError={setError} />}
    </div>
  );
}
