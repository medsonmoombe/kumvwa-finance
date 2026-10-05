import { useEffect, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { FiBarChart2, FiTrendingUp } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import { Avatar, Badge, ErrorBox } from '../../components/ui';
import {
  ChartCard, ChartCardSkeleton, ChartEmpty,
  DataGrid, DataGridSkeleton,
  ListSkeleton, StatBand, StatBandSkeleton,
  CHART_COLORS, baseBarOpts, type Column,
} from '../../components/kit';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Summary {
  counts: { active: number; overdue: number; cleared: number };
  outstandingMinor: string;
  clientsCount: number;
  interestContractedMinor: string;
  interestCollectedMinor: string;
  recentLoans: Array<{ id: string; clientName: string; principalMinor: string; status: string; createdAt: string }>;
}
interface Month { month: string; disbursedMinor: string; collectedMinor: string }
interface Par {
  totalOutstandingMinor: string;
  buckets: Record<string, string>;
  par30Minor: string;
  par30Pct: number;
}
interface Notif { id: string; title: string; createdAt: string }
interface PendingReq { id: string; clientName: string; amountMinor: string; termCount: number }

const parColor = (pct: number) =>
  pct > 10 ? CHART_COLORS.risk : pct > 5 ? CHART_COLORS.warn : '#2E7D32';

const hasData = (m: Month[]) => m.some(
  (x) => Number(x.disbursedMinor) > 0 || Number(x.collectedMinor) > 0,
);

export function DashboardPage() {
  const [s, setS] = useState<Summary | null>(null);
  const [m, setM] = useState<Month[] | null>(null);
  const [par, setPar] = useState<Par | null>(null);
  const [notifs, setNotifs] = useState<Notif[] | null>(null);
  const [pending, setPending] = useState<PendingReq[] | null>(null);
  const [error, setError] = useState('');

  const barRef = useRef<HTMLCanvasElement>(null);
  const parRef = useRef<HTMLCanvasElement>(null);
  const trendRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Summary>('/reports/summary'),
      api.get<Month[]>('/reports/monthly'),
      api.get<Par>('/reports/par'),
      api.get<{ items: Notif[] }>('/notifications', { params: { limit: 5 } }),
      api.get<{ items: PendingReq[] }>('/loan-requests/inbox', { params: { status: 'pending' } }),
    ]).then(([a, b, c, n, r]) => {
      setS(a.data); setM(b.data); setPar(c.data);
      setNotifs(n.data.items.slice(0, 4));
      setPending(r.data.items.slice(0, 4));
    }).catch(() => setError('Could not load dashboard'));
  }, []);

  // chart 1: disbursed vs collected
  useEffect(() => {
    if (!m || !barRef.current || !hasData(m)) return;
    const chart = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: m.map((x) => `${x.month.slice(5)}/${x.month.slice(2, 4)}`),
        datasets: [
          { label: 'Disbursed', data: m.map((x) => Number(x.disbursedMinor) / 100),
            backgroundColor: CHART_COLORS.action, borderRadius: 2,
            barPercentage: 0.55, categoryPercentage: 0.6 },
          { label: 'Collected', data: m.map((x) => Number(x.collectedMinor) / 100),
            backgroundColor: CHART_COLORS.positive, borderRadius: 2,
            barPercentage: 0.55, categoryPercentage: 0.6 },
        ],
      },
      options: baseBarOpts(),
    });
    return () => chart.destroy();
  }, [m]);

  // chart 2: PAR aging
  const parHasData = par && Object.values(par.buckets).some((v) => Number(v) > 0);
  useEffect(() => {
    if (!par || !parRef.current || !parHasData) return;
    const b = par.buckets;
    const chart = new Chart(parRef.current, {
      type: 'bar',
      data: {
        labels: ['Current', '1-30d', '31-60d', '61-90d', '90d+'],
        datasets: [{
          data: [
            Number(b['current'] ?? 0) / 100, Number(b['d1_30'] ?? 0) / 100,
            Number(b['d31_60'] ?? 0) / 100, Number(b['d61_90'] ?? 0) / 100,
            Number(b['d90p'] ?? 0) / 100,
          ],
          backgroundColor: ['#2E7D32', CHART_COLORS.warn, '#F57C00', CHART_COLORS.deep, CHART_COLORS.risk],
          borderRadius: 2, barPercentage: 0.7,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: '#ECECEC' }, border: { display: false },
            ticks: { color: '#888', callback: (v: string | number) => `K${(Number(v) / 1000).toFixed(0)}k` } },
          y: { grid: { display: false }, ticks: { color: '#3A4050', font: { size: 10.5 } } },
        },
      },
    });
    return () => chart.destroy();
  }, [par, parHasData]);

  // chart 3: cumulative trend
  const trendData = useMemo(() => {
    if (!m) return null;
    let acc = 0;
    return m.map((x) => { acc += Number(x.collectedMinor) / 100; return acc; });
  }, [m]);

  useEffect(() => {
    if (!trendData || !m || !trendRef.current || !hasData(m)) return;
    const chart = new Chart(trendRef.current, {
      type: 'line',
      data: {
        labels: m.map((x) => `${x.month.slice(5)}/${x.month.slice(2, 4)}`),
        datasets: [{
          label: 'Cumulative collected',
          data: trendData,
          borderColor: CHART_COLORS.action,
          backgroundColor: 'rgba(26,79,191,0.08)',
          fill: true, tension: 0.35,
          pointRadius: 2.5, pointBackgroundColor: '#fff',
          pointBorderColor: CHART_COLORS.action, pointBorderWidth: 2,
        }],
      },
      options: baseBarOpts(),
    });
    return () => chart.destroy();
  }, [trendData, m]);

  if (error) return <ErrorBox message={error} />;

  // ── loading skeleton ──
  if (!s || !m || !par) {
    return (
      <div>
        <StatBandSkeleton cols={6} />
        <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3.5">
            <ChartCardSkeleton height={250} />
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <ChartCardSkeleton height={210} />
              <ChartCardSkeleton height={210} />
            </div>
            <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
              <div className="band"><div className="h-2.5 w-24 animate-pulse rounded bg-[#E9ECF1]" /></div>
              <DataGridSkeleton rows={4} cols={5} />
            </div>
          </div>
          <div className="space-y-3.5">
            <ChartCardSkeleton height={160} />
            <ChartCardSkeleton height={160} />
            <ChartCardSkeleton height={120} />
          </div>
        </div>
      </div>
    );
  }

  const b = par.buckets;
  const out = Number(par.totalOutstandingMinor);
  const par1 = Number(b['d1_30'] ?? 0) + Number(b['d31_60'] ?? 0) + Number(b['d61_90'] ?? 0) + Number(b['d90p'] ?? 0);
  const par90 = Number(b['d90p'] ?? 0);
  const pctOf = (v: number) => (out > 0 ? ((v / out) * 100).toFixed(1) : '0.0');
  const monthsHaveData = hasData(m);

  const loanCols: Array<Column<Summary['recentLoans'][number]>> = [
    { key: 'c', header: 'Client', render: (l) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={l.clientName} size={26} />
          <b className="font-semibold">{l.clientName}</b>
        </div>) },
    { key: 'r', header: 'Ref', render: (l) => <span className="text-[11px] tabular-nums text-ink-muted">{l.id}</span> },
    { key: 'p', header: 'Principal', render: (l) => <b className="tabular-nums">{money(l.principalMinor)}</b> },
    { key: 'st', header: 'Status', render: (l) => (
        <Badge color={l.status === 'overdue' ? 'red' : l.status === 'cleared' ? 'blue' : 'green'} dot>{l.status}</Badge>) },
    { key: 'd', header: 'Issued', render: (l) => <span className="text-[11px] text-ink-muted">{date(l.createdAt)}</span> },
  ];

  return (
    <div>
      <StatBand
        cols={6}
        items={[
          { label: 'Outstanding', value: money(s.outstandingMinor) },
          { label: 'Active', value: String(s.counts.active), color: '#2E7D32' },
          { label: 'Overdue', value: String(s.counts.overdue), color: CHART_COLORS.risk },
          { label: 'PAR-30', value: `${par.par30Pct.toFixed(1)}%`, color: parColor(par.par30Pct) },
          { label: 'PAR-90', value: `${pctOf(par90)}%`, color: parColor(Number(pctOf(par90))) },
          { label: 'Clients', value: String(s.clientsCount) },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-3.5">
          <ChartCard title="Disbursed vs Collected · last 6 months">
            {monthsHaveData
              ? <canvas ref={barRef} />
              : <ChartEmpty icon={<FiBarChart2 size={18} />} label="No loan activity in the last 6 months" />}
          </ChartCard>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <ChartCard title="Portfolio at Risk · aging" height={210}
              right={parHasData
                ? <span style={{ fontSize: 11, fontWeight: 800, color: parColor(par.par30Pct) }}>PAR-30 {par.par30Pct.toFixed(1)}%</span>
                : undefined}>
              {parHasData
                ? <canvas ref={parRef} />
                : <ChartEmpty icon={<FiBarChart2 size={18} />} label="No overdue loans — portfolio is current" />}
            </ChartCard>
            <ChartCard title="Collections trend · cumulative" height={210}>
              {monthsHaveData
                ? <canvas ref={trendRef} />
                : <ChartEmpty icon={<FiTrendingUp size={18} />} label="No collections recorded yet" />}
            </ChartCard>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band">
              <span className="t">Recent Loans</span>
              <Link to="/loans" className="ml-auto text-[10.5px] font-bold text-brand-600">View all →</Link>
            </div>
            <DataGrid columns={loanCols} rows={s.recentLoans} empty="No loans yet. Approve a request to get started." />
          </div>
        </div>

        <div className="space-y-3.5">
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band">
              <span className="t">Pending Approvals</span>
              <Link to="/requests" className="ml-auto text-[10.5px] font-bold text-brand-600">Inbox →</Link>
            </div>
            <div className="px-3.5 pb-2">
              {pending === null ? (
                <ListSkeleton rows={3} avatar pad="py-3" />
              ) : pending.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-ink-muted">Inbox clear</p>
              ) : pending.map((r) => (
                <Link key={r.id} to="/requests"
                  className="flex items-center gap-2.5 border-b border-line-2 py-2.5 last:border-none">
                  <Avatar name={r.clientName} size={26} tone="amber" />
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-[11.5px] font-semibold text-ink">{r.clientName}</b>
                    <span className="text-[10px] tabular-nums text-ink-muted">
                      {money(r.amountMinor)} · {r.termCount} mo
                    </span>
                  </div>
                  <Badge color="amber">Review</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band"><span className="t">Activity</span></div>
            <div className="px-3.5 pb-2">
              {notifs === null ? (
                <ListSkeleton rows={3} pad="py-3" />
              ) : notifs.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-ink-muted">Nothing yet</p>
              ) : notifs.map((n) => (
                <div key={n.id} className="border-b border-line-2 py-2 last:border-none">
                  <b className="block text-[11.5px] font-semibold text-ink">{n.title}</b>
                  <span className="text-[9.5px] text-gray-400">{date(n.createdAt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-card border border-line bg-white p-3.5">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
              Interest generated
            </div>
            <div className="flex justify-between border-b border-line-2 py-1.5 text-[11.5px]">
              <span className="text-ink-muted">Collected to date</span>
              <b className="tabular-nums text-accent-700">{money(s.interestCollectedMinor)}</b>
            </div>
            <div className="flex justify-between py-1.5 text-[11.5]">
              <span className="text-ink-muted">Booked on issued loans</span>
              <b className="tabular-nums">{money(s.interestContractedMinor)}</b>
            </div>
            <p className="mt-2 text-[9.5px] leading-relaxed text-ink-muted">
              Interest actually banked vs. interest the book is written to earn
              (including rollover extensions).
            </p>
          </div>

          <div className="rounded-card border border-line bg-white p-3.5">
            <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-muted">
              PAR quick reference
            </div>
            {([['PAR-1', pctOf(par1)], ['PAR-30', pctOf(Number(par.par30Minor))], ['PAR-90', pctOf(par90)]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line-2 py-1.5 text-[11.5px] last:border-none">
                <span className="text-ink-muted">{k}</span>
                <b className="tabular-nums" style={{ color: parColor(Number(v)) }}>{v}%</b>
              </div>
            ))}
            <p className="mt-2 text-[9.5px] leading-relaxed text-ink-muted">
              Share of outstanding portfolio past the named day-threshold. The number BOZ examiners and investors read first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
