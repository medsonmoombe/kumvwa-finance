import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { FiBarChart2, FiPieChart, FiTrendingUp } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';

import { Avatar, ErrorBox } from '../../components/ui';
import {
  ChartCard, ChartCardSkeleton, ChartEmpty,
  DataGrid, DataGridSkeleton,
  StatBand, StatBandSkeleton,
  CHART_COLORS, type Column,
} from '../../components/kit';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Stats {
  tenants: { pending: number; active: number; rejected: number; suspended: number; total: number };
  clients: number; users: number;
  loans: Record<string, number>;
  outstandingMinor: string;
}
interface Par { totalOutstandingMinor: string; buckets: Record<string, string>; par30Pct: number }
interface PlatformInterest {
  contractedMinor: string;
  collectedMinor: string;
  lenders: number;
  byLender: Array<{ tenantId: string; tenantName: string; contractedMinor: string; collectedMinor: string }>;
}
interface Month { month: string; disbursedMinor: string; collectedMinor: string }
interface Flag { key: string; label: string; value: boolean; isDefault: boolean }
interface TenantRow {
  id: string; name: string; type: string; status: string; createdAt: string;
  ownerPhone: string | null; ownerName: string | null;
}

const parColor = (pct: number) =>
  pct > 10 ? CHART_COLORS.risk : pct > 5 ? CHART_COLORS.warn : '#2E7D32';

export function AdminOverviewPage() {
  const nav = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [par, setPar] = useState<Par | null>(null);
  const [interest, setInterest] = useState<PlatformInterest | null>(null);
  const [months, setMonths] = useState<Month[] | null>(null);
  const [flags, setFlags] = useState<Flag[] | null>(null);
  const [queue, setQueue] = useState<TenantRow[] | null>(null);
  const [error, setError] = useState('');

  const lenderRef = useRef<HTMLCanvasElement>(null);
  const bookRef = useRef<HTMLCanvasElement>(null);
  const trendRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Stats>('/admin/stats'),
      api.get<{ items: Flag[] }>('/admin/flags'),
      api.get<TenantRow[]>('/admin/tenants', { params: { status: 'pending_verification' } }),
    ]).then(([s, f, q]) => {
      setStats(s.data);
      setFlags(f.data.items);
      setQueue(q.data);
    }).catch(() => setError('Could not load platform data'));

    api.get<Par>('/admin/reports/par')
      .then((r) => setPar(r.data))
      .catch(() => setPar({ totalOutstandingMinor: '0', buckets: {}, par30Pct: 0 }));
    api.get<Month[]>('/admin/reports/monthly')
      .then((r) => setMonths(r.data))
      .catch(() => setMonths([]));
    api.get<PlatformInterest>('/admin/reports/interest')
      .then((r) => setInterest(r.data))
      .catch(() => setInterest({ contractedMinor: '0', collectedMinor: '0', lenders: 0, byLender: [] }));
  }, []);

  // lenders doughnut
  const lenderHasData = stats && stats.tenants.total > 0;
  useEffect(() => {
    if (!stats || !lenderRef.current || !lenderHasData) return;
    const t = stats.tenants;
    const chart = new Chart(lenderRef.current, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Pending', 'Rejected', 'Suspended'],
        datasets: [{
          data: [t.active, t.pending, t.rejected, t.suspended],
          backgroundColor: ['#2E7D32', CHART_COLORS.warn, CHART_COLORS.risk, CHART_COLORS.muted],
          borderWidth: 2, borderColor: '#fff',
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: { legend: { position: 'right',
          labels: { boxWidth: 9, boxHeight: 9, color: '#3A4050' } } },
      },
    });
    return () => chart.destroy();
  }, [stats, lenderHasData]);

  // loan book bar
  const bookHasData = stats && Object.values(stats.loans).some((v) => v > 0);
  useEffect(() => {
    if (!stats || !bookRef.current || !bookHasData) return;
    const l = stats.loans;
    const chart = new Chart(bookRef.current, {
      type: 'bar',
      data: {
        labels: ['Active', 'Overdue', 'Cleared', 'Defaulted'],
        datasets: [{
          data: [l['active'] ?? 0, l['overdue'] ?? 0, l['cleared'] ?? 0, l['defaulted'] ?? 0],
          backgroundColor: ['#2E7D32', CHART_COLORS.risk, CHART_COLORS.action, CHART_COLORS.muted],
          borderRadius: 2, barPercentage: 0.5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#3A4050' } },
          y: { grid: { color: '#ECECEC' }, border: { display: false }, ticks: { color: '#888' } },
        },
      },
    });
    return () => chart.destroy();
  }, [stats, bookHasData]);

  // platform trend line
  const trendHasData = months && months.some(
    (x) => Number(x.disbursedMinor) > 0 || Number(x.collectedMinor) > 0,
  );
  useEffect(() => {
    if (!months || !trendRef.current || !trendHasData) return;
    let acc = 0;
    const collected = months.map((x) => { acc += Number(x.collectedMinor) / 100; return acc; });
    const chart = new Chart(trendRef.current, {
      type: 'line',
      data: {
        labels: months.map((x) => `${x.month.slice(5)}/${x.month.slice(2, 4)}`),
        datasets: [
          { label: 'Disbursed', data: months.map((x) => Number(x.disbursedMinor) / 100),
            borderColor: CHART_COLORS.action, backgroundColor: 'rgba(26,79,191,0.07)',
            fill: true, tension: 0.35, pointRadius: 2,
            pointBackgroundColor: '#fff', pointBorderColor: CHART_COLORS.action },
          { label: 'Collected (cumulative)', data: collected,
            borderColor: CHART_COLORS.positive, tension: 0.35,
            pointRadius: 2, pointBackgroundColor: '#fff',
            pointBorderColor: CHART_COLORS.positive, borderDash: [5, 3] },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', align: 'end',
          labels: { boxWidth: 9, boxHeight: 9, color: '#3A4050' } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#888' } },
          y: { grid: { color: '#ECECEC' }, border: { display: false },
            ticks: { color: '#888', callback: (v: string | number) => `K${(Number(v) / 1000).toFixed(0)}k` } },
        },
      },
    });
    return () => chart.destroy();
  }, [months, trendHasData]);

  async function toggleFlag(key: string, value: boolean) {
    try {
      await api.post('/admin/flags', { key, value });
      setFlags((fs) => fs!.map((f) => (f.key === key ? { ...f, value } : f)));
    } catch { setError('Could not update switch'); }
  }

  if (error && !stats) return <ErrorBox message={error} />;

  // ── loading skeleton ──
  if (!stats || !flags) {
    return (
      <div>
        <StatBandSkeleton cols={6} />
        <div className="mb-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-3">
          <ChartCardSkeleton height={230} />
          <ChartCardSkeleton height={230} />
          <ChartCardSkeleton height={230} />
        </div>
        <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band"><div className="h-2.5 w-32 animate-pulse rounded bg-[#E9ECF1]" /></div>
            <DataGridSkeleton rows={4} cols={3} />
          </div>
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band"><div className="h-2.5 w-32 animate-pulse rounded bg-[#E9ECF1]" /></div>
            <div className="space-y-2 p-3.5">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-[3px] bg-[#E9ECF1]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const queueCols: Array<Column<TenantRow>> = [
    { key: 'n', header: 'Business', render: (t) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={t.name} size={28} />
          <div>
            <b className="block font-semibold">{t.name}</b>
            <span className="text-[10.5px] text-ink-muted">{t.ownerPhone ?? '—'}</span>
          </div>
        </div>) },
    { key: 't', header: 'Type', render: (t) => <span className="capitalize text-ink-2">{t.type}</span> },
    { key: 'd', header: 'Registered', render: (t) => <span className="text-[11px] text-ink-muted">{date(t.createdAt)}</span> },
  ];

  return (
    <div>
      <StatBand
        cols={8}
        items={[
          { label: 'Pending verifications', value: String(stats.tenants.pending),
            color: stats.tenants.pending > 0 ? CHART_COLORS.risk : '#2E7D32' },
          { label: 'Active lenders', value: String(stats.tenants.active) },
          { label: 'Borrowers', value: String(stats.clients) },
          { label: 'Platform outstanding', value: money(stats.outstandingMinor) },
          { label: 'Platform PAR-30', value: par ? `${par.par30Pct.toFixed(1)}%` : '—',
            color: par ? parColor(par.par30Pct) : undefined },
          // Interest generated across EVERY lender.
          { label: 'Interest collected', value: interest ? money(interest.collectedMinor) : '—',
            color: '#2E7D32' },
          { label: 'Interest booked', value: interest ? money(interest.contractedMinor) : '—' },
          { label: 'Accounts', value: String(stats.users) },
        ]}
      />

      {interest && interest.byLender.length > 0 && (
        <div className="mb-3.5 overflow-hidden rounded-card border border-line bg-white shadow-c1">
          <div className="band">
            <span className="t">Interest by lender</span>
            <span className="ml-auto text-[9.5px] text-ink-muted">
              collected vs. booked on the issued book
            </span>
          </div>
          <div className="p-3.5">
            {interest.byLender.slice(0, 8).map((l) => (
              <div key={l.tenantId}
                className="flex items-center justify-between border-b border-line-2 py-2 text-[11.5px] last:border-none">
                <b className="font-semibold">{l.tenantName}</b>
                <span className="flex items-center gap-4 tabular-nums">
                  <span className="text-ink-muted">booked <b className="text-ink-2">{money(l.contractedMinor)}</b></span>
                  <b className="text-accent-700">{money(l.collectedMinor)}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-3">
        <ChartCard title="Lenders by status" height={230}>
          {lenderHasData
            ? <canvas ref={lenderRef} />
            : <ChartEmpty icon={<FiPieChart size={18} />} label="No lenders registered yet" />}
        </ChartCard>
        <ChartCard title="Loan book by status" height={230}>
          {bookHasData
            ? <canvas ref={bookRef} />
            : <ChartEmpty icon={<FiBarChart2 size={18} />} label="No loans on the platform yet" />}
        </ChartCard>
        <ChartCard title="Platform flow · 6 months" height={230}>
          {months === null
            ? <ChartEmpty icon={<FiTrendingUp size={18} />} label="Loading…" />
            : trendHasData
              ? <canvas ref={trendRef} />
              : <ChartEmpty icon={<FiTrendingUp size={18} />} label="No platform activity in the last 6 months" />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
          <div className="band">
            <span className="t">Verification Queue</span>
            <Link to="/admin/queue" className="ml-auto text-[10.5px] font-bold text-brand-600">
              Full queue →
            </Link>
          </div>
          <DataGrid
            columns={queueCols}
            rows={queue}
            onRowClick={(tenant) => nav(`/admin/tenants/${tenant.id}`)}
            empty="Queue is clear. New business registrations appear here for BOZ review."
          />
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
          <div className="band">
            <span className="t">Platform Switches</span>
            <span className="ml-auto text-[9.5px] text-ink-muted">every flip is audited</span>
          </div>
          <div className="space-y-1.5 p-3.5">
            {flags.map((f) => (
              <label key={f.key}
                className={`flex cursor-pointer items-center justify-between rounded-[3px] border px-3 py-2.5 transition-colors ${
                  f.key === 'maintenance_mode' && f.value
                    ? 'border-danger-500/50 bg-danger-50'
                    : f.value ? 'border-accent-500/40 bg-accent-50/50' : 'border-line bg-white'
                }`}>
                <span className="min-w-0 pr-2 text-[11.5px] font-semibold text-ink">{f.label}</span>
                <input type="checkbox" checked={f.value}
                  onChange={(e) => void toggleFlag(f.key, e.target.checked)}
                  className="h-4 w-8 cursor-pointer accent-brand-600" />
              </label>
            ))}
            {flags.find((f) => f.key === 'maintenance_mode')?.value && (
              <div className="rounded-[3px] bg-danger-50 p-2.5 text-[10.5px] font-semibold text-danger-500">
                Maintenance mode is ON. Only platform admins can use the API.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
