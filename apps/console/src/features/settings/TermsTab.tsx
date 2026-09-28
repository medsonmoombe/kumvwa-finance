import { useCallback, useEffect, useState } from 'react';
import { FiFileText } from 'react-icons/fi';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import { ConfirmDialog, Pill, Sk, TextAreaSkeleton } from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface TenantTerms { version: number; body: string; publishedAt: string }

const TEMPLATE = `YOUR BUSINESS — LENDING TERMS (v1)

1. WHO WE ARE
[Business name] is a Bank of Zambia registered lender...

2. LOAN TERMS
Interest, fees and repayment schedules are shown on each loan offer before you accept...

3. REPAYMENT
Repayments are due on the dates shown in your schedule. Late payments may attract penalties as disclosed on your loan...

4. DEFAULT
[Your policy on missed payments, collateral, next-of-kin contact...]

5. DATA
We process your personal data per the Kumvwa Finance Privacy Policy and the Zambia Data Protection Act, 2021...

[FULL TEXT PENDING YOUR REVIEW — edit and publish v1]`;

export function TermsTab({ onFlash }: { onFlash: (m: string) => void }) {
  const { tenant } = useAuth();
  const [current, setCurrent] = useState<TenantTerms | null>(null);
  const [draft, setDraft] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(() => {
    if (!tenant) return;
    api.get<{ version: number | null; body: string | null }>(`/tenants/${tenant.id}/terms`)
      .then((r) => {
        if (r.data.version != null && r.data.body) {
          setCurrent({ version: r.data.version, body: r.data.body, publishedAt: '' });
        } else {
          setDraft(TEMPLATE);
        }
      })
      .catch(() => setError('Could not load terms'))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  useEffect(() => { load(); }, [load]);

  async function publish() {
    if (!tenant) return;
    setPublishing(true); setError('');
    try {
      const res = await api.post<{ version: number }>(`/tenants/${tenant.id}/terms`, { body: draft });
      onFlash(`Terms v${res.data.version} published — clients are asked to accept it on next app open`);
      setCurrent({ version: res.data.version, body: draft, publishedAt: new Date().toISOString() });
      setDraft('');
    } catch (e) { setError(apiError(e)); }
    finally { setPublishing(false); setConfirm(false); }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
            <Sk w="w-36" h="h-2.5" />
            <Sk w="w-20" h="h-2.5" />
          </div>
          <div className="max-h-40 overflow-y-auto p-3.5">
            <TextAreaSkeleton height={130} />
          </div>
          <div className="border-t border-line bg-[#FAFBFD] px-3 py-2">
            <Sk w="w-3/4" h="h-2" />
          </div>
        </div>
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="border-b border-line bg-[#FAFBFD] px-3 py-2">
            <Sk w="w-48" h="h-2.5" />
          </div>
          <div className="p-3.5">
            <TextAreaSkeleton height={280} />
            <div className="mt-3 flex items-center justify-between">
              <Sk w="w-40" h="h-2" />
              <Sk w="w-32" h="h-9" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const draftText = draft || current?.body || '';
  const nextVersion = (current?.version ?? 0) + 1;

  return (
    <>
      <div className="space-y-3">
        {error && <ErrorBox message={error} />}

        {/* current published version */}
        {current && (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                Published version
              </span>
              <div className="flex items-center gap-2">
                <Badge color="green" dot>v{current.version}</Badge>
                {tenant && (
                  <a href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'}/terms/tenant/${tenant.id}/pdf`}
                    className="flex items-center gap-1 text-[10.5px] font-bold text-brand-600 hover:underline">
                    <FiFileText size={11} /> Client PDF
                  </a>
                )}
              </div>
            </div>
            <div className="max-h-40 overflow-y-auto p-3.5">
              <pre className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-2">{current.body}</pre>
            </div>
            <div className="border-t border-line bg-[#FAFBFD] px-3 py-2 text-[10.5px] text-ink-muted">
              Clients with pending acceptance see an amber card on their home screen until they accept this version.
            </div>
          </div>
        )}

        {/* editor */}
        <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
            {current ? `Draft v${nextVersion}` : 'Publish your first lending terms (v1)'}
          </span>
            <span className="text-[10px] text-ink-muted">{draftText.length} chars · min 50</span>
          </div>
          <div className="p-3.5">
            <p className="mb-2 text-[11px] text-ink-muted">
              Publishing creates a new version — history is kept, and every client acceptance is recorded against the exact version they saw.
            </p>
            <textarea
              className={`${inputCls} min-h-[260px] font-mono text-[12px] leading-relaxed`}
              value={draftText}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={TEMPLATE}
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line bg-[#FAFBFD] px-3 py-2">
            <Pill onClick={() => setConfirm(true)}
              disabled={publishing || draftText.trim().length < 50}>
              {current ? `Publish v${nextVersion}` : 'Publish v1'}
            </Pill>
          </div>
        </div>

        <div className="rounded-[3px] border border-line bg-white p-3.5 text-[11.5px] leading-relaxed text-ink-muted">
          <b className="text-ink-2">Suggested content:</b> who you are, loan terms disclosure, repayment expectations, default policy, and how you use client data. Kumvwa's platform terms already cover software liability — this document is <b className="text-ink-2">your</b> lending relationship with <b className="text-ink-2">your</b> clients.
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={publish}
        title={`Publish lending terms v${nextVersion}?`}
        body="All clients will be asked to accept the new version on their next app open. This cannot be undone — the version is permanent."
        confirmLabel={publishing ? 'Publishing…' : `Publish v${nextVersion}`}
        busy={publishing}
      />
    </>
  );
}
