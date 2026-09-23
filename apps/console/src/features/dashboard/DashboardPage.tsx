import { useEffect, useState } from 'react';
import { FiArrowUpRight, FiCheckCircle, FiClipboard, FiUserPlus } from 'react-icons/fi';

import {
  Avatar,
  Badge,
  Card,
  CardHead,
  Empty,
  ErrorBox,
  ProgressBar,
  Spinner,
  StatCard,
} from '../../components/ui';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Summary {
  counts: { active: number; overdue: number; cleared: number };
  outstandingMinor: string;
  clientsCount: number;
  recentLoans: Array<{
    id: string;
    clientName: string;
    principalMinor: string;
    status: string;
    createdAt: string;
  }>;
}
interface Month {
  month: string;
  disbursedMinor: string;
  collectedMinor: string;
}
interface Notif {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  type: string;
}
interface PendingReq {
  id: string;
  clientName: string;
  amountMinor: string;
  termCount: number;
}

const statusColor: Record<string, 'green' | 'red' | 'blue' | 'grey'> = {
  active: 'green',
  overdue: 'red',
  cleared: 'blue',
  defaulted: 'grey',
};

function AreaChart({ months }: { months: Month[] }) {
  const W = 520;
  const H = 150;
  const max = Math.max(
    1,
    ...months.flatMap((m) => [
      Number(m.disbursedMinor),
      Number(m.collectedMinor),
    ]),
  );
  const path = (key: 'disbursedMinor' | 'collectedMinor') =>
    months
      .map(
        (m, i) =>
          `${i === 0 ? 'M' : 'L'}${(i / (months.length - 1)) * W},${
            H - (Number(m[key]) / max) * (H - 24) - 8
          }`,
      )
      .join(' ');
  const dLine = path('disbursedMinor');
  const cLine = path('collectedMinor');

  return (
    <div className="px-4 pb-3 pt-4">
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2E63E6" stopOpacity=".25" />
            <stop offset="1" stopColor="#2E63E6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[30, 70, 110].map((y) => (
          <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="#EEF1F7" />
        ))}
        <path d={`${dLine} L${W},${H} L0,${H} Z`} fill="url(#ag)" />
        <path
          d={dLine}
          fill="none"
          stroke="#2E63E6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d={cLine}
          fill="none"
          stroke="#2ECC71"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <div className="flex justify-between px-0.5 pt-1 text-[9.5px] text-gray-400">
        {months.map((m) => (
          <span key={m.month}>
            {m.month.slice(5)}/{m.month.slice(2, 4)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Donut({ a, o, c }: { a: number; o: number; c: number }) {
  const total = Math.max(1, a + o + c);
  const C = 2 * Math.PI * 52;
  const seg = (v: number) => (v / total) * C;
  return (
    <div className="flex flex-col items-center p-4">
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r="52" fill="none" stroke="#EEF1F7" strokeWidth="15" />
        <circle
          cx="65"
          cy="65"
          r="52"
          fill="none"
          stroke="#2ECC71"
          strokeWidth="15"
          strokeDasharray={`${seg(a)} ${C}`}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
        <circle
          cx="65"
          cy="65"
          r="52"
          fill="none"
          stroke="#2E63E6"
          strokeWidth="15"
          strokeDasharray={`${seg(c)} ${C}`}
          strokeDashoffset={-seg(a)}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
        <circle
          cx="65"
          cy="65"
          r="52"
          fill="none"
          stroke="#C03538"
          strokeWidth="15"
          strokeDasharray={`${seg(o)} ${C}`}
          strokeDashoffset={-(seg(a) + seg(c))}
          strokeLinecap="round"
          transform="rotate(-90 65 65)"
        />
        <text
          x="65"
          y="61"
          textAnchor="middle"
          fontFamily="Poppins"
          fontWeight="700"
          fontSize="20"
          fill="#0F1115"
        >
          {total > 1 ? a + o + c : 0}
        </text>
        <text x="65" y="77" textAnchor="middle" fontSize="9.5" fill="#7A8194">
          loans
        </text>
      </svg>
      <div className="mt-3 w-full space-y-1 text-[11px] text-ink-2">
        <div className="flex justify-between py-0.5">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-accent-500" />
            Active
          </span>
          <b className="tabular-nums">{a}</b>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-brand-500" />
            Cleared
          </span>
          <b className="tabular-nums">{c}</b>
        </div>
        <div className="flex justify-between py-0.5">
          <span className="flex items-center gap-2">
            <i className="h-2 w-2 rounded-full bg-danger-500" />
            Overdue
          </span>
          <b className="tabular-nums">{o}</b>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [months, setMonths] = useState<Month[] | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [pending, setPending] = useState<PendingReq[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Summary>('/reports/summary'),
      api.get<Month[]>('/reports/monthly'),
      api.get<{ items: Notif[] }>('/notifications', { params: { limit: 5 } }),
      api.get<{ items: PendingReq[] }>('/loan-requests/inbox', {
        params: { status: 'pending' },
      }),
    ])
      .then(([s, m, n, r]) => {
        setSummary(s.data);
        setMonths(m.data);
        setNotifs(n.data.items.slice(0, 4));
        setPending(r.data.items.slice(0, 3));
      })
      .catch(() => setError('Could not load dashboard'));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!summary || !months) {
    return (
      <div className="flex justify-center py-24">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const collectedSpark = [...months]
    .reverse()
    .map((m) => Number(m.collectedMinor));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-[18px] font-bold tracking-tight">
            Good{' '}
            {new Date().getHours() < 12
              ? 'morning'
              : new Date().getHours() < 18
                ? 'afternoon'
                : 'evening'}
          </h1>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            Portfolio overview
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Outstanding portfolio" value={money(summary.outstandingMinor)} />
        <StatCard
          label="Collected (6 mo)"
          value={money(
            months.reduce((a, m) => a + BigInt(m.collectedMinor), 0n).toString(),
          )}
          tone="green"
          spark={collectedSpark}
        />
        <StatCard label="Overdue loans" value={String(summary.counts.overdue)} tone="red" />
        <StatCard label="Clients" value={String(summary.clientsCount)} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_300px]">
        <div>
          <Card>
            <CardHead
              title="Disbursed vs Collected"
              right={
                <div className="flex gap-3 text-[10.5px] font-semibold text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm bg-brand-500" />
                    Disbursed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="h-2 w-2 rounded-sm bg-accent-500" />
                    Collected
                  </span>
                </div>
              }
            />
            <AreaChart months={months} />
          </Card>

          <Card className="mt-3.5">
            <CardHead
              title="Recent Loans"
              right={
                <a className="text-[11px] font-bold text-brand-600" href="/loans">
                  View all →
                </a>
              }
            />
            {summary.recentLoans.length === 0 ? (
              <Empty
                icon={<FiClipboard />}
                title="No loans yet"
                hint="Invite clients and approve their requests to get started"
              />
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-[#FAFBFD] text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    <th className="px-4 py-2">Client</th>
                    <th className="px-4 py-2">Loan</th>
                    <th className="px-4 py-2 text-right">Principal</th>
                    <th className="px-4 py-2">Progress</th>
                    <th className="px-4 py-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentLoans.map((l) => (
                    <tr
                      key={l.id}
                      className="border-t border-line-2 text-[12.5px] hover:bg-[#FAFBFE]"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.clientName} size={30} />
                          <b className="font-semibold">{l.clientName}</b>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] tabular-nums text-ink-muted">
                        {l.id}
                      </td>
                      <td className="px-4 py-2.5 text-right font-display font-bold tabular-nums">
                        {money(l.principalMinor)}
                      </td>
                      <td className="w-[110px] px-4 py-2.5">
                        <ProgressBar
                          pct={
                            l.status === 'cleared'
                              ? 100
                              : l.status === 'overdue'
                                ? 35
                                : 60
                          }
                          danger={l.status === 'overdue'}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge color={statusColor[l.status] ?? 'grey'} dot>
                          {l.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <Donut a={summary.counts.active} o={summary.counts.overdue} c={summary.counts.cleared} />
          </Card>

          <Card className="mt-3.5">
            <CardHead
              title="Pending Approvals"
              right={
                <a className="text-[11px] font-bold text-brand-600" href="/requests">
                  Inbox →
                </a>
              }
            />
            <div className="px-4 pb-3">
              {pending.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-ink-muted">
                  No pending requests
                </p>
              ) : (
                pending.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 border-b border-line-2 py-2.5 last:border-none"
                  >
                    <Avatar name={r.clientName} size={28} tone="amber" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] text-ink-2">
                        <b className="font-semibold text-ink">{r.clientName}</b> ·{' '}
                        {money(r.amountMinor)} / {r.termCount} mo
                      </p>
                    </div>
                    <a
                      href="/requests"
                      className="flex items-center gap-0.5 rounded-lg bg-accent-500 px-2.5 py-1.5 text-[10.5px] font-bold text-white hover:bg-accent-700"
                    >
                      Review <FiArrowUpRight size={11} />
                    </a>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="mt-3.5">
            <CardHead title="Activity" />
            <div className="px-4 pb-3">
              {notifs.length === 0 ? (
                <p className="py-5 text-center text-[12px] text-ink-muted">
                  Nothing yet
                </p>
              ) : (
                notifs.map((n) => (
                  <div
                    key={n.id}
                    className="flex gap-2.5 border-b border-line-2 py-2.5 last:border-none"
                  >
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] ${
                        n.type === 'loan_overdue'
                          ? 'bg-danger-50 text-danger-500'
                          : n.type === 'client_activity'
                            ? 'bg-brand-50 text-brand-600'
                            : 'bg-accent-50 text-accent-700'
                      }`}
                    >
                      {n.type === 'loan_overdue' ? (
                        '!'
                      ) : n.type === 'client_activity' ? (
                        <FiUserPlus size={12} />
                      ) : (
                        <FiCheckCircle size={12} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11.5px] leading-snug text-ink-2">
                        <b className="font-semibold text-ink">{n.title}</b> —{' '}
                        {n.body}
                      </p>
                      <time className="mt-0.5 block text-[9.5px] text-gray-400">
                        {date(n.createdAt)}
                      </time>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
