import { useCallback, useEffect, useState } from 'react';
import {
  FiCalendar,
  FiCheck,
  FiDollarSign,
  FiInbox,
  FiMapPin,
  FiX,
} from 'react-icons/fi';

import {
  Avatar,
  Badge,
  Card,
  CenteredSpinner,
  Empty,
  ErrorBox,
  PageHead,
  Spinner,
} from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Req {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  amountMinor: string;
  termCount: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  feedback: string | null;
  requestedAt: string;
}
interface Risk {
  score: number | null;
  band: string | null;
  limitKwacha: number;
}

const statusColor = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
} as const;

export function RequestsPage() {
  const [items, setItems] = useState<Req[] | null>(null);
  const [selected, setSelected] = useState<Req | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get<{ items: Req[] }>('/loan-requests/inbox')
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load requests'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingCount =
    items?.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead
        title="Loan Requests"
        sub={
          items ? `${pendingCount} pending · ${items.length} total` : undefined
        }
      />
      {error && <ErrorBox message={error} />}
      {!items ? (
        <CenteredSpinner />
      ) : items.length === 0 ? (
        <Card>
          <Empty
            icon={<FiInbox />}
            title="No loan requests yet"
            hint="Client requests will appear here for review"
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`block w-full rounded-card border bg-white p-4 text-left shadow-c1 ${
                r.status === 'pending'
                  ? 'border-line hover:border-brand-100'
                  : 'border-line opacity-90'
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar
                  name={r.clientName}
                  tone={
                    r.status === 'approved'
                      ? 'green'
                      : r.status === 'rejected'
                        ? 'red'
                        : 'brand'
                  }
                />
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold">
                    {r.clientName}
                  </b>
                  <span className="text-[11px] tabular-nums text-ink-muted">
                    {r.id.slice(0, 10)} · {date(r.requestedAt)}
                  </span>
                </div>
                <Badge color={statusColor[r.status]} dot>
                  {r.status}
                </Badge>
              </div>
              <div className="mt-2.5 flex gap-4 text-[11.5px] tabular-nums text-ink-2">
                <span className="flex items-center gap-1">
                  <FiDollarSign size={12} />
                  <b className="font-bold text-ink">{money(r.amountMinor)}</b>
                </span>
                <span className="flex items-center gap-1">
                  <FiCalendar size={12} />
                  <b className="font-bold text-ink">{r.termCount} mo</b>
                </span>
                <span className="flex min-w-0 items-center gap-1 truncate">
                  <FiMapPin size={12} className="shrink-0" /> {r.purpose}
                </span>
              </div>
              {r.status === 'rejected' && r.feedback && (
                <div className="mt-2.5 rounded-xl bg-danger-50 p-2.5 text-[11.5px] leading-snug text-danger-500">
                  <b>Feedback:</b> {r.feedback}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <ReviewDrawer
          req={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ReviewDrawer({
  req,
  onClose,
  onDone,
}: {
  req: Req;
  onClose: () => void;
  onDone: () => void;
}) {
  const [risk, setRisk] = useState<Risk | null>(null);
  const [rate, setRate] = useState(15);
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Risk>(`/clients/${req.clientId}/risk`)
      .then((r) => setRisk(r.data))
      .catch(() => {});
  }, [req.clientId]);

  const amount = BigInt(req.amountMinor);
  const total = amount + (amount * BigInt(rate)) / 100n;

  async function act(action: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      if (action === 'approve') {
        await api.post(`/loan-requests/${req.id}/approve`, {
          rateBps: rate * 100,
        });
      } else {
        await api.post(`/loan-requests/${req.id}/reject`, { feedback });
      }
      onDone();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0D1426]/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <aside
        className="absolute right-0 top-0 flex h-full w-[360px] flex-col overflow-y-auto border-l border-line bg-white p-5 shadow-[-18px_0_44px_rgba(15,17,21,0.1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="font-display text-[16px] font-bold">
            Review Request
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-ink-muted hover:text-ink"
          >
            <FiX size={14} />
          </button>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
          <Avatar name={req.clientName} size={38} />
          <div>
            <b className="text-[13px]">{req.clientName}</b>
            <div className="text-[10.5px] tabular-nums text-ink-muted">
              {req.phone}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {(
            [
              ['Amount requested', money(req.amountMinor)],
              ['Term', `${req.termCount} months`],
              ['Purpose', req.purpose],
              ['Requested', date(req.requestedAt)],
            ] as const
          ).map(([k, v]) => (
            <div
              key={k}
              className="flex items-start justify-between gap-3 border-b border-line-2 py-2 text-[12px]"
            >
              <span className="text-ink-muted">{k}</span>
              <b className="text-right font-semibold text-ink">{v}</b>
            </div>
          ))}
        </div>

        {risk && (
          <>
            <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
              Risk profile (internal)
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <b
                  className={`block font-display text-[16px] tabular-nums ${
                    risk.band === 'low'
                      ? 'text-accent-700'
                      : risk.band === 'high'
                        ? 'text-danger-500'
                        : 'text-warn-500'
                  }`}
                >
                  {risk.score ?? '—'}
                </b>
                <span className="text-[9.5px] font-semibold text-ink-muted">
                  Score
                </span>
              </div>
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <b className="block font-display text-[16px] capitalize text-ink">
                  {risk.band ?? 'none'}
                </b>
                <span className="text-[9.5px] font-semibold text-ink-muted">
                  Band
                </span>
              </div>
              <div className="rounded-xl bg-surface p-2.5 text-center">
                <b className="block font-display text-[16px] tabular-nums text-ink">
                  K{risk.limitKwacha.toLocaleString()}
                </b>
                <span className="text-[9.5px] font-semibold text-ink-muted">
                  Limit
                </span>
              </div>
            </div>
          </>
        )}

        {req.status === 'pending' ? (
          <>
            <div className="mt-5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
              Interest rate (flat)
            </div>
            <b className="font-display text-[24px] tabular-nums text-brand-600">
              {rate}%
            </b>
            <input
              type="range"
              min={10}
              max={30}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-1"
            />
            <div className="mt-1.5 flex justify-between border-b border-line-2 pb-3 text-[12px]">
              <span className="text-ink-muted">Total repayable</span>
              <b className="font-display text-[13.5px] tabular-nums text-ink">
                {money(total.toString())}
              </b>
            </div>
            <textarea
              className="mt-4 w-full rounded-input border-[1.5px] border-line px-3.5 py-2.5 text-[12.5px] outline-none focus:border-brand-500"
              rows={2}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Rejection feedback (required if declining)…"
            />
            {error && (
              <div className="mt-2.5">
                <ErrorBox message={error} />
              </div>
            )}
            <div className="mt-auto flex gap-2.5 pt-4">
              <button
                disabled={busy || feedback.trim().length < 10}
                onClick={() => act('reject')}
                className="h-[48px] flex-1 rounded-btn border-[1.5px] border-danger-500/40 font-bold text-danger-500 hover:bg-danger-50 disabled:opacity-40"
              >
                Decline
              </button>
              <button
                disabled={busy}
                onClick={() => act('approve')}
                className="flex h-[48px] flex-[1.4] items-center justify-center gap-1.5 rounded-btn bg-accent-500 font-bold text-white hover:bg-accent-700 disabled:opacity-40"
              >
                {busy ? (
                  <Spinner className="mx-auto border-white" />
                ) : (
                  <>
                    <FiCheck size={15} /> Approve at {rate}%
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-auto pt-4">
            <Badge color={statusColor[req.status]} dot>
              Already {req.status}
            </Badge>
          </div>
        )}
      </aside>
    </div>
  );
}
