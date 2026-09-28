import { useCallback, useEffect, useState } from 'react';
import { FiArrowLeft, FiCheck, FiCopy, FiRefreshCw } from 'react-icons/fi';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Badge, ErrorBox, Spinner } from '../../components/ui';
import {
  Field, FormGrid, FormSection, PageActionBar, Pill,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface InviteDetail {
  id: string;
  clientId: string | null;
  clientName: string;
  phone: string;
  status: string;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
}

interface ClientDetail {
  id: string; name: string; phone: string; email: string | null;
  nrc: string | null; dob: string | null; address: string | null;
  employmentStatus: string | null; incomeBand: string | null;
  incomeSource: string | null; kinName: string | null; kinPhone: string | null;
  nrcPhotoFileId: string | null; nrcBackPhotoFileId: string | null;
  lendersCount: number; joinedAt: string;
}

const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  pending: 'amber', completed: 'green', expired: 'grey', cancelled: 'red',
};

const EMPLOYMENT: Record<string, string> = {
  formal_employment: 'Formal employment', self_employed: 'Self-employed',
  farming: 'Farming', informal: 'Informal work', other: 'Other',
};
const INCOME: Record<string, string> = {
  b0_1000: 'K 0 – K 1,000', b1001_3000: 'K 1,001 – K 3,000',
  b3001_6000: 'K 3,001 – K 6,000', b6000_plus: 'K 6,000+',
};

export function InviteDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [invite, setInvite] = useState<InviteDetail | null>(null);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState('');
  const [resendResult, setResendResult] = useState<{ code: string; link: string } | null>(null);
  const [resendBusy, setResendBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoSide, setPhotoSide] = useState<'front' | 'back'>('front');
  const [showPhoto, setShowPhoto] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      // Fetch the invite from the list endpoint filtered by id — we reuse listForTenant
      const res = await api.get<{ items: InviteDetail[] }>('/invites');
      const found = res.data.items.find((i) => i.id === id);
      if (!found) { setError('Invite not found'); return; }
      setInvite(found);
      if (found.clientId) {
        const cr = await api.get<ClientDetail>(`/clients/${found.clientId}`);
        setClient(cr.data);
      }
    } catch (e) { setError(apiError(e)); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // Auto-trigger resend if navigated with ?resend=1
  useEffect(() => {
    if (params.get('resend') === '1' && invite?.status === 'pending' && !resendResult) {
      void resend();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invite]);

  async function resend() {
    if (!id) return;
    setResendBusy(true); setError('');
    try {
      const res = await api.post<{ code: string; link: string }>(`/invites/${id}/resend`);
      setResendResult({ code: res.data.code, link: res.data.link });
    } catch (e) { setError(apiError(e)); }
    finally { setResendBusy(false); }
  }

  async function viewPhoto(side: 'front' | 'back') {
    if (!client) return;
    try {
      const res = await api.get<{ url: string }>(`/clients/${client.id}/nrc-photo?side=${side}`);
      setPhotoSide(side); setPhotoUrl(res.data.url); setShowPhoto(true);
    } catch (e) { setError(apiError(e)); }
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  if (error && !invite) return <ErrorBox message={error} />;
  if (!invite) return <div className="animate-pulse text-[12px] text-ink-muted p-4">Loading…</div>;

  const profileComplete = client && (
    client.nrc && client.dob && client.address &&
    client.employmentStatus && client.incomeBand
  );

  return (
    <div>
      <Link to="/invites" className="mb-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-muted hover:text-ink">
        <FiArrowLeft size={12} /> All invites
      </Link>

      <PageActionBar
        title={invite.clientName}
        sub={`${invite.phone} · invited ${date(invite.createdAt)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge color={STATUS_COLOR[invite.status] ?? 'grey'} dot>{invite.status}</Badge>
            {invite.status === 'pending' && (
              <Pill onClick={() => void resend()} disabled={resendBusy}>
                {resendBusy ? <Spinner className="border-white" /> : <><FiRefreshCw size={11} /> Resend</>}
              </Pill>
            )}
            {client && (
              <Pill tone="ghost" onClick={() => nav(`/clients/${client.id}`)}>
                View full client profile →
              </Pill>
            )}
          </div>
        }
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {/* Resend result */}
      {resendResult && (
        <div className="mb-3 space-y-2 rounded-card border border-emerald-200 bg-accent-50 p-4">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-accent-700">
            <FiCheck size={13} /> New code sent — share it with the client
          </div>
          <CodeBox label="New invite code" value={resendResult.code} copied={copied} onCopy={copy} copyKey="code" />
          <CodeBox label="App link" value={resendResult.link} copied={copied} onCopy={copy} copyKey="link" mono={false} />
        </div>
      )}

      {/* Invite info */}
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <FormSection title="Invite details" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Status"><Badge color={STATUS_COLOR[invite.status] ?? 'grey'} dot>{invite.status}</Badge></Field>
            <Field label="Invited on">{date(invite.createdAt)}</Field>
            <Field label="Expires">{date(invite.expiresAt)}</Field>
            {invite.completedAt && <Field label="Completed">{date(invite.completedAt)}</Field>}
          </FormGrid>
        </FormSection>

        {/* Client profile — shown once the invite is completed */}
        {client ? (
          <>
            <FormSection title="Personal information" defaultOpen>
              <FormGrid cols={3}>
                <Field label="Full name">{client.name}</Field>
                <Field label="Phone"><span className="tabular-nums">{client.phone}</span></Field>
                <Field label="Email">{client.email ?? '—'}</Field>
                <Field label="NRC"><span className="tabular-nums">{client.nrc ?? '—'}</span></Field>
                <Field label="Date of birth">{client.dob ? date(client.dob) : '—'}</Field>
                <Field label="Address">{client.address ?? '—'}</Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Income & employment" defaultOpen>
              <FormGrid cols={3}>
                <Field label="Employment status">
                  {client.employmentStatus ? (EMPLOYMENT[client.employmentStatus] ?? client.employmentStatus) : '—'}
                </Field>
                <Field label="Monthly income">
                  {client.incomeBand ? (INCOME[client.incomeBand] ?? client.incomeBand) : '—'}
                </Field>
                <Field label="Income source">{client.incomeSource ?? '—'}</Field>
                <Field label="Next of kin">{client.kinName ?? '—'}</Field>
                <Field label="Kin phone">
                  {client.kinPhone ? <span className="tabular-nums">{client.kinPhone}</span> : '—'}
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Identity documents" defaultOpen>
              <div className="flex flex-wrap gap-3">
                {client.nrcPhotoFileId ? (
                  <button onClick={() => void viewPhoto('front')}
                    className="rounded-[3px] border border-brand-300 bg-brand-50 px-3 py-2 text-[11.5px] font-bold text-brand-600 hover:bg-brand-100">
                    View NRC front (audited)
                  </button>
                ) : (
                  <span className="text-[12px] text-ink-muted">NRC front — not uploaded</span>
                )}
                {client.nrcBackPhotoFileId ? (
                  <button onClick={() => void viewPhoto('back')}
                    className="rounded-[3px] border border-line bg-surface px-3 py-2 text-[11.5px] font-bold text-ink-2 hover:bg-[#ECEEF2]">
                    View NRC back (audited)
                  </button>
                ) : (
                  <span className="text-[12px] text-ink-muted">NRC back — not uploaded</span>
                )}
              </div>
              {!profileComplete && (
                <p className="mt-3 rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                  Profile incomplete — the client has not finished the KYC wizard in the app yet.
                </p>
              )}
            </FormSection>
          </>
        ) : (
          <div className="border-t border-line px-4 py-6 text-center text-[12px] text-ink-muted">
            {invite.status === 'pending'
              ? 'Client has not redeemed this invite yet — no profile to show.'
              : invite.status === 'expired'
                ? 'This invite expired before the client redeemed it.'
                : 'No client profile linked to this invite.'}
          </div>
        )}
      </div>

      {/* NRC photo modal */}
      {showPhoto && photoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1426]/50 p-4"
          onClick={() => setShowPhoto(false)}>
          <div className="max-w-md rounded-card bg-white p-4 shadow-c3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-[13px] font-bold">NRC {photoSide} · {client?.name}</b>
              <button onClick={() => setShowPhoto(false)} className="text-[18px] leading-none text-ink-muted">✕</button>
            </div>
            <img src={photoUrl} alt="NRC" className="max-h-[60vh] w-full rounded-[3px] border border-line object-contain" />
            <p className="mt-2 text-[10px] text-ink-muted">This access was recorded in the audit log.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBox({ label, value, copied, onCopy, copyKey, mono = true }: {
  label: string; value: string; copied: string;
  onCopy: (v: string, k: string) => void; copyKey: string; mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">{label}</div>
      <div className="flex items-center justify-between rounded-[3px] border border-line bg-white px-3 py-2.5">
        <span className={mono ? 'font-mono text-[15px] font-bold tracking-[0.18em] text-brand-600' : 'truncate text-[11px] text-brand-600'}>
          {value}
        </span>
        <button onClick={() => onCopy(value, copyKey)}
          className="ml-2 flex shrink-0 items-center gap-1 text-[10.5px] font-bold text-brand-600 hover:text-brand-900">
          {copied === copyKey ? <FiCheck size={12} /> : <FiCopy size={12} />}
          {copied === copyKey ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
