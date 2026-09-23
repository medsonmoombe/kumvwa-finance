import { useCallback, useEffect, useState } from 'react';
import { FiArrowLeft, FiCheck } from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Card,
  CenteredSpinner,
  ErrorBox,
  ProgressBar,
  Spinner,
} from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Installment {
  seq: number;
  dueDate: string;
  amountMinor: string;
  paidAmountMinor: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt: string | null;
}
interface Loan {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  productName: string | null;
  status: string;
  rateBps: number;
  termCount: number;
  principalMinor: string;
  totalDueMinor: string;
  paidAmountMinor: string;
  outstandingMinor: string;
  disbursedAt: string;
  schedule: Installment[];
}
interface Repayment {
  id: string;
  amountMinor: string;
  method: string;
  reference: string | null;
  createdAt: string;
}

const METHODS = ['cash', 'mobile_money', 'bank', 'in_app'] as const;

export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('mobile_money');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      api.get<Loan>(`/loans/${id}`),
      api.get<{ items: Repayment[] }>(`/loans/${id}/repayments`),
    ])
      .then(([l, r]) => {
        setLoan(l.data);
        setRepayments(r.data.items);
      })
      .catch(() => setError('Could not load loan'));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    if (!id) return;
    setBusy(true);
    setFormError('');
    setNotice('');
    try {
      const res = await api.post(`/loans/${id}/repayments`, {
        amount: Number(amount),
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      setNotice(
        res.data.replayed
          ? 'Duplicate detected — the original payment stands.'
          : `Payment of ${money(res.data.amountMinor)} recorded.`,
      );
      setAmount('');
      setReference('');
      load();
    } catch (e) {
      setFormError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox message={error} />;
  if (!loan) return <CenteredSpinner />;

  const outstanding = Number(loan.outstandingMinor);
  const total = Number(loan.totalDueMinor) || 1;
  const paid = Number(loan.paidAmountMinor);

  const statusColor =
    loan.status === 'cleared'
      ? 'blue'
      : loan.status === 'overdue'
        ? 'red'
        : loan.status === 'defaulted'
          ? 'grey'
          : 'green';

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/loans"
        className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-muted hover:text-ink"
      >
        <FiArrowLeft size={13} /> All loans
      </Link>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-brand-600 to-brand-900 p-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={loan.clientName} size={40} />
              <div>
                <b className="block text-[15px] font-bold">{loan.clientName}</b>
                <span className="text-[11.5px] tabular-nums text-[#B9CBEF]">
                  {loan.clientPhone} · disbursed {date(loan.disbursedAt)}
                  {loan.productName ? ` · ${loan.productName}` : ''}
                </span>
              </div>
            </div>
            <Badge color={statusColor} dot>
              {loan.status}
            </Badge>
          </div>
          <div className="mt-4 font-display text-[30px] font-extrabold tabular-nums">
            {money(loan.outstandingMinor)}
          </div>
          <p className="text-[11.5px] text-[#A9BEE8]">outstanding</p>
          <div className="mt-3">
            <ProgressBar pct={(paid / total) * 100} danger={loan.status === 'overdue'} />
            <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums text-[#A9BEE8]">
              <span>Paid {money(loan.paidAmountMinor)}</span>
              <span>of {money(loan.totalDueMinor)} · {loan.rateBps / 100}% flat</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-[1fr_340px]">
        {/* ── timeline schedule ── */}
        <Card>
          <div className="p-4">
            <b className="text-[13px]">Repayment Schedule</b>
            <div className="relative ml-[15px] mt-3 border-l-2 border-line pb-2 pl-7">
              {loan.schedule.map((s) => {
                const paidRow = s.status === 'paid';
                const overdue = s.status === 'overdue';
                return (
                  <div key={s.seq} className="relative py-2.5">
                    <span
                      className={`absolute -left-[35px] top-3 h-3.5 w-3.5 rounded-full border-[2.5px] border-white ${
                        paidRow
                          ? 'bg-accent-500'
                          : overdue
                            ? 'bg-danger-500'
                            : 'animate-pulse bg-brand-500'
                      }`}
                      style={{ boxShadow: '0 0 0 2px #E7EAF1' }}
                    />
                    <b className="block text-[12.5px] font-semibold">
                      Installment {s.seq} ·{' '}
                      {paidRow
                        ? 'Paid'
                        : overdue
                          ? 'Overdue'
                          : 'Due ' + date(s.dueDate)}
                    </b>
                    <span className="text-[10.5px] tabular-nums text-ink-muted">
                      {date(s.dueDate)}
                      {paidRow && s.paidAt ? ` · paid ${date(s.paidAt)}` : ''}
                    </span>
                    <span
                      className={`absolute right-0 top-2.5 font-display text-[12.5px] font-bold tabular-nums ${
                        paidRow ? 'text-accent-700' : 'text-ink'
                      }`}
                    >
                      {money(s.amountMinor)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <div>
          {/* ── record repayment ── */}
          <Card className="p-4">
            <b className="text-[13px]">Record Repayment</b>
            <div className="mt-3 space-y-2.5">
              <div className="flex gap-2">
                <input
                  className="w-full rounded-input border-[1.5px] border-line px-3.5 py-2.5 text-[13.5px] tabular-nums outline-none focus:border-brand-500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount in K"
                  inputMode="decimal"
                />
                <button
                  type="button"
                  onClick={() => setAmount((outstanding / 100).toFixed(2))}
                  className="shrink-0 rounded-btn border-[1.5px] border-brand-100 px-3 text-[11.5px] font-bold text-brand-600 hover:bg-brand-50"
                >
                  Full
                </button>
              </div>
              <select
                className="w-full rounded-input border-[1.5px] border-line bg-white px-3 py-2.5 text-[13px] outline-none focus:border-brand-500"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-input border-[1.5px] border-line px-3.5 py-2.5 text-[13px] outline-none focus:border-brand-500"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Reference (optional)"
              />
              {formError && <ErrorBox message={formError} />}
              {notice && (
                <div className="rounded-xl bg-accent-50 px-3.5 py-2.5 text-[12px] font-semibold text-accent-700">
                  <FiCheck size={13} className="inline-block" /> {notice}
                </div>
              )}
              <button
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={submit}
                className="flex h-[46px] w-full items-center justify-center rounded-btn bg-accent-500 font-bold text-white hover:bg-accent-700 disabled:opacity-40"
              >
                {busy ? <Spinner className="border-white" /> : 'Record Payment'}
              </button>
            </div>
          </Card>

          {/* ── history ── */}
          <Card className="mt-3.5">
            <div className="border-b border-line-2 px-4 py-3">
              <b className="text-[13px]">History</b>
            </div>
            <div className="px-4 pb-3">
              {repayments.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-ink-muted">
                  No repayments yet
                </p>
              ) : (
                repayments.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between border-b border-line-2 py-2.5 text-[12px] last:border-none"
                  >
                    <div>
                      <b className="font-display font-bold tabular-nums">
                        {money(r.amountMinor)}
                      </b>
                      <div className="text-[10.5px] capitalize text-ink-muted">
                        {r.method.replaceAll('_', ' ')} · {date(r.createdAt)}
                        {r.reference ? ` · ${r.reference}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <button
            onClick={() => nav('/clients')}
            className="mt-3.5 w-full rounded-btn border-[1.5px] border-line py-2.5 text-[12px] font-semibold text-ink-2 hover:bg-line-2"
          >
            View client portfolio
          </button>
        </div>
      </div>
    </div>
  );
}
