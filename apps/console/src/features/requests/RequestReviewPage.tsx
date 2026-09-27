import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  BandCardSkeleton, DataGrid, DataGridSkeleton, DetailPageSkeleton,
  Field, FormGrid, FormSection, PageActionBar, Pill, StatBand, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Req {
  id: string; clientId: string; clientName: string; phone: string;
  amountMinor: string; termCount: number; purpose: string;
  status: 'pending' | 'approved' | 'rejected'; feedback: string | null;
  requestedAt: string; loanId: string | null;
}
interface Risk { score: number | null; band: string | null; limitKwacha: number }
interface LoanRow { id: string; status: string; principalMinor: string; totalDueMinor: string; paidAmountMinor: string }

const statusColor = { pending: 'amber', approved: 'green', rejected: 'red' } as const;

export function RequestReviewPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [r, setR] = useState<Req | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [clientLoans, setClientLoans] = useState<LoanRow[] | null>(null);
  const [rate, setRate] = useState(15);
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'fortnightly'>('monthly');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    api.get<Req>(`/loan-requests/${id}`)
      .then((res: { data: Req }) => {
        setR(res.data);
        api.get<Risk>(`/clients/${res.data.clientId}/risk`)
          .then((x: { data: Risk }) => setRisk(x.data)).catch(() => {});
        return api.get<{ items: LoanRow[] }>('/loans');
      })
      .then((res: { data: { items: LoanRow[] } }) => setClientLoans(res.data.items))
      .catch((e: unknown) => setError(apiError(e)));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function act(action: 'approve' | 'reject') {
    if (!r) return;
    setBusy(true); setError('');
    try {
      if (action === 'approve') {
        await api.post(`/loan-requests/${r.id}/approve`, { rateBps: rate * 100, frequency });
      } else {
        await api.post(`/loan-requests/${r.id}/reject`, { feedback });
      }
      nav('/requests');
    } catch (e) {
      setError(apiError(e));
      setBusy(false);
    }
  }

  if (error && !r) return <ErrorBox message={error} />;

  // ── loading skeleton ──
  if (!r) {
    return (
      <div>
        <DetailPageSkeleton fields={9} />
        <div className="mt-3.5">
          <BandCardSkeleton title="w-48">
            <DataGridSkeleton rows={3} cols={3} />
          </BandCardSkeleton>
        </div>
      </div>
    );
  }

  const pending = r.status === 'pending';
  const amount = BigInt(r.amountMinor);
  const total = amount + (amount * BigInt(rate)) / 100n;

  const historyCols: Array<Column<LoanRow>> = [
    { key: 'id', header: 'Ref', render: (l) => <span className="font-mono text-[11px]">{l.id.slice(0, 12)}…</span> },
    {
      key: 'st', header: 'Status',
      render: (l) => (
        <Badge color={l.status === 'overdue' ? 'red' : l.status === 'cleared' ? 'blue' : 'green'} dot>
          {l.status}
        </Badge>
      ),
    },
    {
      key: 'o', header: 'Outstanding',
      render: (l) => (
        <span className="tabular-nums">
          {money((BigInt(l.totalDueMinor) - BigInt(l.paidAmountMinor)).toString())}
        </span>
      ),
    },
  ];

  return (
    <div>
      <Link to="/requests" className="mb-3 inline-block text-[12px] font-semibold text-ink-muted hover:text-ink">
        ← All requests
      </Link>

      <PageActionBar
        title={`Review · ${r.clientName}`}
        sub={`${r.id} · requested ${date(r.requestedAt)}`}
        actions={pending ? (
          <>
            <Pill tone="danger" onClick={() => act('reject')}
              disabled={busy || feedback.trim().length < 10}>
              Decline
            </Pill>
            <Pill onClick={() => act('approve')} disabled={busy}>
              {busy ? 'Working…' : `✓ Approve at ${rate}% · ${frequency}`}
            </Pill>
          </>
        ) : (
          <Badge color={statusColor[r.status]} dot>{r.status}</Badge>
        )}
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <StatBand
        cols={4}
        items={[
          { label: 'Amount requested', value: money(r.amountMinor) },
          { label: 'Term', value: `${r.termCount} month${r.termCount === 1 ? '' : 's'}` },
          { label: 'Approving at', value: pending ? `${rate}% · ${frequency}` : '—', color: '#1A4FBF' },
          { label: 'Total if approved', value: pending ? money(total.toString()) : '—' },
        ]}
      />

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <FormSection title="Application" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Purpose">{r.purpose}</Field>
            <Field label="Requested">{date(r.requestedAt)}</Field>
            <Field label="Linked loan">{r.loanId ?? 'None (pending)'}</Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Applicant" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Name">{r.clientName}</Field>
            <Field label="Phone"><span className="tabular-nums">{r.phone}</span></Field>
            <Field label="Full profile">
              <Link to={`/clients/${r.clientId}`} className="text-[11.5px] font-bold text-brand-600">
                Open profile →
              </Link>
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Repayment History on Kumvwa" defaultOpen>
          <p className="mb-2.5 text-[10px] text-ink-muted">
            Internal platform data. Bureau scoring runs server-side when the agreement is signed.
          </p>
          {clientLoans === null ? (
            <DataGridSkeleton rows={3} cols={3} />
          ) : clientLoans.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-ink-muted">
              First-time borrower — no repayment history yet
            </p>
          ) : (
            <DataGrid columns={historyCols} rows={clientLoans} />
          )}
        </FormSection>

        {pending && (
          <FormSection title="Decision" defaultOpen>
            {risk && (
              <div className="mb-3 grid grid-cols-3 gap-2.5">
                <div className="border border-line bg-surface p-2.5 text-center">
                  <div className="text-[9px] font-bold uppercase text-ink-muted">Score</div>
                  <b className="font-display text-[16px] tabular-nums"
                    style={{ color: risk.band === 'low' ? '#2E7D32' : risk.band === 'high' ? '#C62828' : '#B26A00' }}>
                    {risk.score ?? '—'}
                  </b>
                </div>
                <div className="border border-line bg-surface p-2.5 text-center">
                  <div className="text-[9px] font-bold uppercase text-ink-muted">Band</div>
                  <b className="font-display text-[16px] capitalize">{risk.band ?? 'none'}</b>
                </div>
                <div className="border border-line bg-surface p-2.5 text-center">
                  <div className="text-[9px] font-bold uppercase text-ink-muted">Current limit</div>
                  <b className="font-display text-[16px] tabular-nums">K{risk.limitKwacha.toLocaleString()}</b>
                </div>
              </div>
            )}
            <FormGrid cols={2}>
              <Field label={`Interest rate: ${rate}% flat`}>
                <input type="range" min={10} max={30} value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-brand-600" />
              </Field>
              <Field label="Repayment frequency">
                <select className={inputCls} value={frequency}
                  onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
                  <option value="monthly">Monthly (1 month per term)</option>
                  <option value="fortnightly">Fortnightly (2 weeks per term)</option>
                  <option value="weekly">Weekly (1 week per term)</option>
                </select>
              </Field>
              <Field label="Decline feedback (required if declining, min 10 chars)" span={2}>
                <input className={inputCls} value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="The client reads this verbatim…" />
              </Field>
            </FormGrid>
          </FormSection>
        )}

        {!pending && r.feedback && (
          <FormSection title="Decision Record" defaultOpen>
            <div className="rounded-[3px] bg-red-50 p-3 text-[11.5px] text-red-700">
              <b>Feedback sent:</b> {r.feedback}
            </div>
          </FormSection>
        )}
      </div>
    </div>
  );
}
