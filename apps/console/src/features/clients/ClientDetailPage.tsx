import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  BandCardSkeleton, DataGrid, DataGridSkeleton, DetailPageSkeleton,
  Field, FormGrid, FormSection, PageActionBar, Pill, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface ClientDetail {
  id: string; name: string; nrc: string | null; phone: string; email: string | null;
  dob: string | null; address: string | null;
  employmentStatus: string | null; incomeBand: string | null; incomeSource: string | null;
  kinName: string | null; kinPhone: string | null;
  nrcPhotoFileId: string | null;
  nrcBackPhotoFileId: string | null;
  lendersCount: number; joinedAt: string;
  loans: Array<{ id: string; loanRef: string; status: string; createdAt: string; principal: string; outstanding: string }>;
  repayments: Array<{ id: string; loanId: string; loanRef: string; amount: string; method: string; reference: string | null; recordedAt: string }>;
  risk: { score: number | null; band: string | null; source: string; checkedAt: string } | null;
  limitOverride: { limitKwacha: number; reason: string; grantedAt: string } | null;
}

const EMPLOYMENT: Record<string, string> = {
  formal_employment: 'Formal employment', self_employed: 'Self-employed',
  farming: 'Farming', informal: 'Informal work', other: 'Other',
};
const INCOME: Record<string, string> = {
  b0_1000: 'K 0 – K 1,000', b1001_3000: 'K 1,001 – K 3,000',
  b3001_6000: 'K 3,001 – K 6,000', b6000_plus: 'K 6,000+',
};
const loanStatusColor: Record<string, 'green' | 'red' | 'blue' | 'grey'> = {
  active: 'green', overdue: 'red', cleared: 'blue', defaulted: 'grey',
};

function limitFromScore(score: number): number {
  if (score >= 750) return 15000;
  if (score >= 700) return 10000;
  if (score >= 600) return 5000;
  if (score >= 550) return 3000;
  return 1500;
}

export function ClientDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [c, setC] = useState<ClientDetail | null>(null);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // Which face is open in the viewer — the certificate check needs both.
  const [photoSide, setPhotoSide] = useState<'front' | 'back'>('front');
  const [showPhoto, setShowPhoto] = useState(false);
  const [overrideLimit, setOverrideLimit] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<ClientDetail>(`/clients/${id}`)
      .then((r) => setC(r.data))
      .catch((e) => setError(apiError(e)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // A presigned URL is minted per open, never cached: the URL the page loaded
  // ten minutes ago is already stale, and each read is its own audit entry.
  async function viewPhoto(side: 'front' | 'back') {
    try {
      const res = await api.get<{ url: string }>(`/clients/${id}/nrc-photo?side=${side}`);
      setPhotoSide(side);
      setPhotoUrl(res.data.url);
      setShowPhoto(true);
    } catch (e) { setError(apiError(e)); }
  }

  async function grantOverride() {
    if (!c || !overrideLimit || overrideReason.trim().length < 5) return;
    setBusy(true); setError('');
    try {
      await api.post(`/clients/${c.id}/limit-override`,
        { limitKwacha: Number(overrideLimit), reason: overrideReason.trim() });
      setOverrideLimit(''); setOverrideReason('');
      load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  if (error && !c) return <ErrorBox message={error} />;

  // ── loading skeleton ──
  if (!c) {
    return (
      <div>
        <DetailPageSkeleton fields={9} />
        <div className="mt-3.5">
          <BandCardSkeleton title="w-32">
            <DataGridSkeleton rows={4} cols={5} />
          </BandCardSkeleton>
        </div>
        <div className="mt-3.5">
          <BandCardSkeleton title="w-40">
            <DataGridSkeleton rows={3} cols={5} />
          </BandCardSkeleton>
        </div>
      </div>
    );
  }

  const riskColor = c.risk?.band === 'low' ? '#2E7D32' : c.risk?.band === 'high' ? '#C62828' : '#B26A00';
  const baseLimit = limitFromScore(c.risk?.score ?? 0);
  const effectiveLimit = c.limitOverride?.limitKwacha ?? baseLimit;

  const loanCols: Array<Column<ClientDetail['loans'][number]>> = [
    { key: 'id', header: 'Loan ref', render: (l) => <span className="tabular-nums text-[11px] text-ink-muted">{l.loanRef}</span> },
    { key: 'p', header: 'Principal', render: (l) => <b className="tabular-nums">K {Number(l.principal).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> },
    { key: 'o', header: 'Outstanding', render: (l) => <span className="tabular-nums">K {Number(l.outstanding).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
    { key: 'st', header: 'Status', render: (l) => <Badge color={loanStatusColor[l.status] ?? 'grey'} dot>{l.status}</Badge> },
    { key: 'd', header: 'Issued', render: (l) => <span className="text-[11px] text-ink-muted">{date(l.createdAt)}</span> },
  ];
  const repaymentCols: Array<Column<ClientDetail['repayments'][number]>> = [
    { key: 'loan', header: 'Loan', render: (r) => <span className="font-semibold text-brand-600">{r.loanRef}</span> },
    { key: 'amount', header: 'Amount', render: (r) => <b className="tabular-nums text-accent-700">K {Number(r.amount).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> },
    { key: 'method', header: 'Method', render: (r) => <span className="capitalize">{r.method.replaceAll('_', ' ')}</span> },
    { key: 'reference', header: 'Reference', render: (r) => <span className="text-ink-muted">{r.reference ?? '—'}</span> },
    { key: 'date', header: 'Recorded', render: (r) => <span className="text-[11px] text-ink-muted">{date(r.recordedAt)}</span> },
  ];

  return (
    <div>
      <Link to="/clients" className="mb-3 inline-block text-[11.5px] font-semibold text-ink-muted hover:text-ink">
        ← All clients
      </Link>

      <PageActionBar
        title={c.name}
        sub={`${c.lendersCount} lender${c.lendersCount === 1 ? '' : 's'} on platform · joined ${date(c.joinedAt)}`}
        actions={<>
          {c.nrcPhotoFileId && <Pill onClick={() => void viewPhoto('front')}>View NRC Front</Pill>}
          {c.nrcBackPhotoFileId && <Pill tone="ghost" onClick={() => void viewPhoto('back')}>View NRC Back</Pill>}
          {c.limitOverride && <Badge color="amber">Override active</Badge>}
        </>}
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {/* profile document */}
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <FormSection title="Profile" defaultOpen>
          <FormGrid cols={3}>
            <Field label="NRC"><span className="text-[12px] tabular-nums">{c.nrc ?? '—'}</span></Field>
            <Field label="Phone"><span className="text-[12px] tabular-nums">{c.phone}</span></Field>
            <Field label="Email">{c.email ?? '—'}</Field>
            <Field label="Date of birth">{c.dob ? date(c.dob) : '—'}</Field>
            <Field label="Address">{c.address ?? '—'}</Field>
            <Field label="Status"><Badge color="green" dot>Active</Badge></Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Income and Employment" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Employment status">
              {c.employmentStatus ? (EMPLOYMENT[c.employmentStatus] ?? c.employmentStatus) : '—'}
            </Field>
            <Field label="Monthly income">
              {c.incomeBand ? (INCOME[c.incomeBand] ?? c.incomeBand) : '—'}
            </Field>
            <Field label="Income source">{c.incomeSource ?? '—'}</Field>
            <Field label="Next of kin">{c.kinName ?? '—'}</Field>
            <Field label="Next of kin phone">
              {c.kinPhone ? <span className="tabular-nums">{c.kinPhone}</span> : '—'}
            </Field>
            <Field label="NRC photos on file">
              {c.nrcPhotoFileId || c.nrcBackPhotoFileId ? (
                <span className="flex flex-wrap gap-x-3 gap-y-1">
                  {c.nrcPhotoFileId && (
                    <button onClick={() => void viewPhoto('front')} className="text-[11.5px] font-bold text-brand-600 underline">
                      Front (access is audited)
                    </button>
                  )}
                  {c.nrcBackPhotoFileId && (
                    <button onClick={() => void viewPhoto('back')} className="text-[11.5px] font-bold text-brand-600 underline">
                      Back (access is audited)
                    </button>
                  )}
                </span>
              ) : 'Not uploaded'}
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Credit Profile" defaultOpen>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="border border-line bg-surface p-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted">Score</div>
              <div className="mt-1 font-display text-[17px] font-extrabold" style={{ color: riskColor }}>
                {c.risk?.score ?? '—'}
              </div>
            </div>
            <div className="border border-line bg-surface p-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted">Band</div>
              <div className="mt-1 font-display text-[15px] font-extrabold capitalize" style={{ color: riskColor }}>
                {c.risk?.band ?? 'none'}
              </div>
            </div>
            <div className="border border-line bg-surface p-2.5">
              <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted">Base limit</div>
              <div className="mt-1 font-display text-[15px] font-extrabold">
                K {baseLimit.toLocaleString('en-ZM')}
              </div>
            </div>
            <div className="border border-line p-2.5" style={{ background: c.limitOverride ? '#FDF3E0' : undefined }}>
              <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted">Effective limit</div>
              <div className="mt-1 font-display text-[15px] font-extrabold"
                style={{ color: c.limitOverride ? '#B26A00' : undefined }}>
                K {effectiveLimit.toLocaleString('en-ZM')}
              </div>
              {c.limitOverride && (
                <div className="mt-0.5 text-[9px] text-warn-500">override · {c.limitOverride.reason}</div>
              )}
            </div>
          </div>
          {c.risk && (
            <p className="mt-2 text-[10px] text-ink-muted">
              Source: {c.risk.source} · checked {date(c.risk.checkedAt)} · internal scoring (bureau pending)
            </p>
          )}
        </FormSection>
      </div>

      {/* loans */}
      <div className="mt-3.5 overflow-hidden rounded-card border border-line bg-white">
        <div className="band"><span className="t">Loans ({c.loans.length})</span></div>
        <DataGrid
          columns={loanCols}
          rows={c.loans}
          onRowClick={(l) => nav(`/loans/${l.id}`)}
          empty="No loans yet for this client"
        />
      </div>

      <div className="mt-3.5 overflow-hidden rounded-card border border-line bg-white">
        <div className="band"><span className="t">Repayment History ({c.repayments.length})</span></div>
        <DataGrid
          columns={repaymentCols}
          rows={c.repayments}
          onRowClick={(r) => nav(`/loans/${r.loanId}`)}
          empty="No repayments recorded for this client"
        />
      </div>

      {/* override management */}
      <div className="mt-3.5 overflow-hidden rounded-card border border-line bg-white">
        <FormSection title="Credit Limit Override" defaultOpen={!!c.limitOverride}>
          <FormGrid cols={3}>
            <Field label="New limit (K)">
              <input className={inputCls} inputMode="numeric" value={overrideLimit}
                onChange={(e) => setOverrideLimit(e.target.value)} placeholder="e.g. 8000" />
            </Field>
            <Field label="Reason" required>
              <input className={inputCls} value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Long-standing customer with strong record" />
            </Field>
            <Field label="Action">
              <Pill onClick={grantOverride}
                disabled={busy || !overrideLimit || overrideReason.trim().length < 5}>
                {busy ? 'Saving…' : 'Grant Override'}
              </Pill>
            </Field>
          </FormGrid>
          <p className="mt-2 text-[10px] text-ink-muted">
            Overrides replace the tier limit for this client at application time,
            capped by your policy ceiling. Every grant and revoke is audited with your name.
          </p>
        </FormSection>
      </div>

      {/* NRC photo modal */}
      {showPhoto && photoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1426]/50 p-4 sm:p-6"
          onClick={() => setShowPhoto(false)}>
          <div className="max-w-md rounded-card bg-white p-4 shadow-c3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-[13px] font-bold">NRC {photoSide} photo · {c.name}</b>
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
