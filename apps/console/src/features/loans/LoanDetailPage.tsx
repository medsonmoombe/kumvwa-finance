import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheck, FiPieChart, FiRefreshCw } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Chart from 'chart.js/auto';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  BandCardSkeleton, ChartCard, ChartCardSkeleton, ChartEmpty, DataGrid,
  ListSkeleton, PageHeadSkeleton, StatBandSkeleton,
  PageActionBar, Pill, StatBand, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Installment {
  seq: number; dueDate: string; amountMinor: string; paidAmountMinor: string;
  penaltyMinor: string; status: 'pending' | 'paid' | 'overdue'; paidAt: string | null;
  rolloverFee?: boolean;
}
interface Loan {
  id: string; clientId: string; clientName: string; clientPhone: string;
  productName: string | null; status: string; rateBps: number; termCount: number;
  frequency: string; feeMinor: string; disbursementMinor: string; rolloverCount: number;
  loanRef: string; principalMinor: string; totalDueMinor: string;
  paidAmountMinor: string; outstandingMinor: string; disbursedAt: string;
  schedule: Installment[];
}
interface Repayment {
  id: string; amountMinor?: string; amount?: string; method: string;
  kind?: 'repayment' | 'rollover_interest'; reference: string | null; createdAt: string;
}

const METHODS = ['cash', 'mobile_money', 'bank', 'in_app'] as const;

function frequencyLabel(f: string) {
  if (f === 'weekly') return 'Weekly';
  if (f === 'fortnightly') return 'Fortnightly';
  return 'Monthly';
}

export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[] | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('mobile_money');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [rolloverBusy, setRolloverBusy] = useState(false);
  const [rolloverError, setRolloverError] = useState('');
  const [rolloverNotice, setRolloverNotice] = useState('');
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);

  const allocRef = useRef<HTMLCanvasElement>(null);
  const paymentKeys = useRef(new Map<string, string>());

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      api.get<Loan>(`/loans/${id}`),
      api.get<{ items: Repayment[] }>(`/loans/${id}/repayments`),
    ])
      .then(([l, r]) => { setLoan(l.data); setRepayments(r.data.items); })
      .catch(() => setError('Could not load loan'));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const allocHasData = loan && Number(loan.totalDueMinor) > 0;
  useEffect(() => {
    if (!loan || !allocRef.current || !allocHasData) return;
    const paid = Number(loan.paidAmountMinor);
    const out = Math.max(0, Number(loan.totalDueMinor) - paid);
    const chart = new Chart(allocRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Repaid', 'Outstanding'],
        datasets: [{
          data: [paid, out],
          backgroundColor: ['#2E7D32', '#D9DDE3'],
          borderWidth: 2, borderColor: '#fff',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '64%',
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, boxHeight: 9, color: '#3A4050' } } },
      },
    });
    return () => chart.destroy();
  }, [loan, allocHasData]);

  async function submit() {
    if (!id) return;
    setBusy(true); setFormError(''); setNotice('');
    const operation = `${id}:${amount}:${method}:${reference.trim()}`;
    const idempotencyKey = paymentKeys.current.get(operation) ?? crypto.randomUUID();
    paymentKeys.current.set(operation, idempotencyKey);
    try {
      const res = await api.post(`/loans/${id}/repayments`, {
        amount: Number(amount), method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      }, { headers: { 'Idempotency-Key': idempotencyKey } });
      paymentKeys.current.delete(operation);
      setNotice(
        res.data.replayed
          ? 'Duplicate detected — the original payment stands.'
          : `Payment of ${money(res.data.amountMinor)} recorded.`,
      );
      setAmount(''); setReference('');
      load();
    } catch (e) {
      setFormError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitRollover() {
    if (!id) return;
    setShowRolloverConfirm(false);
    setRolloverBusy(true); setRolloverError(''); setRolloverNotice('');
    try {
      await api.post(`/loans/${id}/rollover`, { method });
      setRolloverNotice('Loan extended — due dates shifted one month forward.');
      load();
    } catch (e) {
      setRolloverError(apiError(e));
    } finally {
      setRolloverBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} />;

  if (!loan) {
    return (
      <div>
        <div className="mb-3 h-2.5 w-28 animate-pulse rounded bg-[#E9ECF1]" />
        <PageHeadSkeleton />
        <StatBandSkeleton cols={4} />
        <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_320px]">
          <BandCardSkeleton title="w-40" right>
            <ListSkeleton rows={6} pad="p-4 pl-7" />
          </BandCardSkeleton>
          <div className="space-y-3.5">
            <ChartCardSkeleton height={190} />
            <BandCardSkeleton title="w-32">
              <div className="space-y-2.5 p-3.5">
                <div className="h-[38px] w-full animate-pulse rounded-[2px] bg-[#E9ECF1]" />
                <div className="h-[38px] w-full animate-pulse rounded-[2px] bg-[#E9ECF1]" />
                <div className="h-[38px] w-full animate-pulse rounded-[2px] bg-[#E9ECF1]" />
              </div>
            </BandCardSkeleton>
          </div>
        </div>
        <div className="mt-3.5">
          <BandCardSkeleton title="w-40">
            <ListSkeleton rows={4} pad="p-3.5" />
          </BandCardSkeleton>
        </div>
      </div>
    );
  }

  const outstanding = Number(loan.outstandingMinor);
  const paid = Number(loan.paidAmountMinor);
  const total = Number(loan.totalDueMinor) || 1;
  const pct = Math.min(100, (paid / total) * 100);

  // Extension fee preview = totalDue - principal - origination fee
  // This is the max interest charged; actual fee may be less if client
  // already made partial payments (API calculates exact amount).
  const extensionFeePreviewMinor = loan
    ? Math.max(0, Number(loan.totalDueMinor) - Number(loan.principalMinor) - Number(loan.feeMinor))
    : 0;

  const statusColor =
    loan.status === 'cleared' ? 'blue'
    : loan.status === 'overdue' ? 'red'
    : loan.status === 'defaulted' ? 'grey'
    : 'green';

  // Extension fee rows from repayment history
  const extensionRows = (repayments ?? []).filter((r) => r.kind === 'rollover_interest');

  // Can extend: active/overdue, not yet extended (rolloverCount === 0), has outstanding
  const canExtend =
    loan.status !== 'cleared' &&
    loan.status !== 'defaulted' &&
    loan.rolloverCount === 0 &&
    outstanding > 0;

  const repayCols: Array<Column<Repayment>> = [
    { key: 'a', header: 'Amount', render: (r) => <b className="tabular-nums">{money(r.amountMinor ?? r.amount ?? '0')}</b> },
    { key: 'm', header: 'Type', render: (r) => <span className="capitalize text-ink-2">{r.kind === 'rollover_interest' ? 'Interest extension' : r.method.replaceAll('_', ' ')}</span> },
    { key: 'r', header: 'Reference', render: (r) => <span className="text-[11px] text-ink-muted">{r.reference ?? '—'}</span> },
    { key: 'd', header: 'Date', render: (r) => <span className="text-[11px] text-ink-muted">{date(r.createdAt)}</span> },
  ];

  return (
    <div>
      <Link to="/loans" className="mb-3 inline-block text-[12px] font-semibold text-ink-muted hover:text-ink">
        ← All loans
      </Link>

      <PageActionBar
        title={loan.loanRef ?? loan.id.slice(0, 12)}
        sub={`${loan.clientName} · ${loan.clientPhone} · disbursed ${date(loan.disbursedAt)}${loan.productName ? ` · ${loan.productName}` : ''}`}
        actions={
          <>
            <Badge color={statusColor} dot>{loan.status}</Badge>
            {loan.rolloverCount > 0 && (
              <Badge color="amber">{loan.rolloverCount}× extended</Badge>
            )}
            <Pill tone="ghost" onClick={() => nav(`/clients/${loan.clientId}`)}>
              View client
            </Pill>
          </>
        }
      />

      <StatBand
        cols={4}
        items={[
          { label: 'Principal', value: money(loan.principalMinor) },
          { label: 'Outstanding', value: money(loan.outstandingMinor), color: loan.status === 'overdue' ? '#C62828' : undefined },
          { label: 'Paid', value: money(loan.paidAmountMinor), color: '#2E7D32' },
          { label: 'Progress', value: `${pct.toFixed(0)}%` },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_320px]">
        {/* ── schedule ── */}
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="band"><span className="t">Repayment Schedule</span>
            <span className="ml-auto text-[9.5px] text-ink-muted">
              {frequencyLabel(loan.frequency)} · {(loan.rateBps / 100).toFixed(0)}% flat
              {Number(loan.feeMinor) > 0 && ` · fee ${money(loan.feeMinor)}`}
            </span>
          </div>
          <div className="relative ml-[15px] border-l-2 border-line p-4 pl-7">
            {loan.schedule.filter((s) => !s.rolloverFee).map((s) => {
              const isPaid = s.status === 'paid';
              const isOverdue = s.status === 'overdue';
              return (
                <div key={s.seq} className="relative py-2.5">
                  <span className={`absolute -left-[35px] top-3 h-3.5 w-3.5 rounded-full border-[2.5px] border-white ${
                    isPaid ? 'bg-accent-500' : isOverdue ? 'bg-danger-500' : 'animate-pulse bg-brand-500'
                  }`} style={{ boxShadow: '0 0 0 2px #E7EAF1' }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <b className="block text-[12.5px] font-semibold">
                        Installment {s.seq} — {isPaid ? 'Paid' : isOverdue ? 'Overdue' : `Due ${date(s.dueDate)}`}
                      </b>
                      <span className="text-[10.5px] tabular-nums text-ink-muted">
                        {date(s.dueDate)}{isPaid && s.paidAt ? ` · paid ${date(s.paidAt)}` : ''}
                      </span>
                      {Number(s.penaltyMinor) > 0 && (
                        <span className="ml-2 text-[10.5px] font-bold tabular-nums text-danger-500">
                          + penalty {money(s.penaltyMinor)}
                        </span>
                      )}
                    </div>
                    <span className={`shrink-0 font-display text-[12.5px] font-bold tabular-nums ${isPaid ? 'text-accent-700' : 'text-ink'}`}>
                      {money(s.amountMinor)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Extensions section — sourced from repayment history, not installments */}
          {extensionRows.length > 0 && (
            <>
              <div className="band border-t border-line">
                <span className="t">Extensions</span>
                <span className="ml-auto text-[9.5px] font-bold text-amber-600">{extensionRows.length}× carried over</span>
              </div>
              <div className="divide-y divide-line-2 px-4 pb-2">
                {extensionRows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <span className="block text-[12px] font-semibold text-ink">Extension fee paid</span>
                      <span className="text-[10.5px] text-ink-muted">{date(r.createdAt)} · {r.method.replaceAll('_', ' ')}</span>
                    </div>
                    <span className="text-[12.5px] font-bold tabular-nums text-amber-700">
                      {money(r.amountMinor ?? r.amount ?? '0')}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── right rail ── */}
        <div className="space-y-3.5">
          <ChartCard title="Allocation" height={190}>
            {allocHasData
              ? <canvas ref={allocRef} />
              : <ChartEmpty icon={<FiPieChart size={18} />} label="Nothing to allocate on this loan" />}
          </ChartCard>

          {loan.status !== 'cleared' && (
            <div className="overflow-hidden rounded-card border border-line bg-white">
              <div className="band"><span className="t">Record Repayment</span></div>
              <div className="p-3.5 space-y-2.5">
                <div className="flex gap-2">
                  <input className={`${inputCls} min-w-0`} value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount in K" inputMode="decimal" />
                  <button type="button"
                    onClick={() => setAmount((outstanding / 100).toFixed(2))}
                    className="shrink-0 rounded-[3px] border border-brand-100 px-3 text-[11.5px] font-bold text-brand-600 hover:bg-brand-50">
                    Full
                  </button>
                </div>
                <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>
                  ))}
                </select>
                <input className={inputCls} value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference (optional)" />
                {formError && <ErrorBox message={formError} />}
                {notice && (
                  <div className="rounded-[3px] bg-accent-50 px-3.5 py-2.5 text-[12px] font-semibold text-accent-700">
                    <FiCheck size={13} className="inline-block" /> {notice}
                  </div>
                )}
                <Pill onClick={submit} disabled={busy || !amount || Number(amount) <= 0}>
                  {busy ? 'Recording…' : 'Record Payment'}
                </Pill>
              </div>
            </div>
          )}

          {/* ── Extend loan (one-time only) ── */}
          {canExtend && (
            <div className="overflow-hidden rounded-card border border-amber-200 bg-amber-50">
              <div className="band border-b border-amber-200 bg-amber-50">
                <FiRefreshCw size={13} className="text-amber-600" />
                <span className="t ml-1.5 text-amber-800">Extend loan</span>
              </div>
              <div className="p-3.5 space-y-2.5">
                <p className="text-[11.5px] text-amber-800 leading-relaxed">
                  Client pays the remaining interest now. All unpaid due dates shift +1 month.
                  <b className="block mt-1">One extension allowed per loan.</b>
                </p>
                <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{m.replaceAll('_', ' ')}</option>
                  ))}
                </select>
                {rolloverError && <ErrorBox message={rolloverError} />}
                {rolloverNotice && (
                  <div className="rounded-[3px] bg-accent-50 px-3.5 py-2.5 text-[12px] font-semibold text-accent-700">
                    <FiCheck size={13} className="inline-block" /> {rolloverNotice}
                  </div>
                )}
                <Pill tone="ghost" onClick={() => setShowRolloverConfirm(true)} disabled={rolloverBusy}>
                  {rolloverBusy ? 'Processing…' : 'Extend by 1 month'}
                </Pill>
              </div>
            </div>
          )}

          {/* Already extended notice */}
          {loan.rolloverCount > 0 && loan.status !== 'cleared' && (
            <div className="rounded-card border border-amber-200 bg-amber-50 px-3.5 py-3 text-[11.5px] text-amber-800">
              This loan has been extended once. No further extensions are allowed.
            </div>
          )}
        </div>
      </div>

      {/* ── Rollover confirmation dialog ── */}
      {showRolloverConfirm && loan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[14px] bg-white shadow-xl">
            <div className="border-b border-line px-5 py-4">
              <p className="text-[14px] font-bold text-ink">Confirm loan extension</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-[8px] bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-ink-muted">Extension fee (interest)</span>
                  <b className="tabular-nums text-amber-700">{money(String(extensionFeePreviewMinor))}</b>
                </div>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-ink-muted">Due dates shift</span>
                  <b className="text-ink">+1 month</b>
                </div>
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-ink-muted">Extensions remaining after</span>
                  <b className="text-ink">0 (no more allowed)</b>
                </div>
              </div>
              <p className="text-[11.5px] text-ink-muted leading-relaxed">
                The client pays <b className="text-ink">{money(String(extensionFeePreviewMinor))}</b> now.
                All unpaid due dates move one month forward. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 border-t border-line px-5 py-3">
              <button
                onClick={() => setShowRolloverConfirm(false)}
                className="flex-1 rounded-[6px] border border-line py-2 text-[12.5px] font-semibold text-ink hover:bg-[#F5F6F8]">
                Cancel
              </button>
              <button
                onClick={submitRollover}
                className="flex-1 rounded-[6px] bg-amber-500 py-2 text-[12.5px] font-bold text-white hover:bg-amber-600">
                Confirm extension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── repayment history ── */}
      <div className="mt-3.5 overflow-hidden rounded-card border border-line bg-white">
        <div className="band">
          <span className="t">Repayment History ({repayments?.length ?? 0})</span>
        </div>
        <DataGrid
          columns={repayCols}
          rows={repayments}
          empty="No repayments recorded yet"
        />
      </div>
    </div>
  );
}
