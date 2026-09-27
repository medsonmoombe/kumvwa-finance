import { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import { FiBarChart2, FiPieChart, FiTrendingUp } from 'react-icons/fi';

import { ErrorBox } from '../../components/ui';
import {
  BandCardSkeleton, ChartCard, ChartCardSkeleton, ChartEmpty, ListSkeleton,
  PageHeadSkeleton, StatBandSkeleton,
  CHART_COLORS, PageActionBar, StatBand, baseBarOpts,
} from '../../components/kit';
import { api } from '../../lib/api';
import { money } from '../../lib/format';

interface Month { month: string; disbursedMinor: string; collectedMinor: string }
interface Summary {
  counts: { active: number; overdue: number; cleared: number };
  outstandingMinor: string;
}
interface Par { buckets: Record<string, string>; par30Pct: number; totalOutstandingMinor: string }

const monthsHaveData = (m: Month[]) =>
  m.some((x) => Number(x.disbursedMinor) > 0 || Number(x.collectedMinor) > 0);

const bucketsHaveData = (p: Par) =>
  Object.values(p.buckets).some((v) => Number(v) > 0);

export function ReportsPage() {
  const [months, setMonths] = useState<Month[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [par, setPar] = useState<Par | null>(null);
  const [error, setError] = useState('');

  const barRef = useRef<HTMLCanvasElement>(null);
  const trendRef = useRef<HTMLCanvasElement>(null);
  const parRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Month[]>('/reports/monthly'),
      api.get<Summary>('/reports/summary'),
      api.get<Par>('/reports/par'),
    ])
      .then(([m, s, p]) => { setMonths(m.data); setSummary(s.data); setPar(p.data); })
      .catch(() => setError('Could not load reports'));
  }, []);

  const hasFlow = months ? monthsHaveData(months) : false;
  const hasPar = par ? bucketsHaveData(par) : false;

  // grouped bars — disbursed vs collected
  useEffect(() => {
    if (!months || !barRef.current || !hasFlow) return;
    const chart = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: months.map((x) => `${x.month.slice(5)}/${x.month.slice(2, 4)}`),
        datasets: [
          {
            label: 'Disbursed',
            data: months.map((x) => Number(x.disbursedMinor) / 100),
            backgroundColor: CHART_COLORS.action, borderRadius: 2,
            barPercentage: 0.55, categoryPercentage: 0.6,
          },
          {
            label: 'Collected',
            data: months.map((x) => Number(x.collectedMinor) / 100),
            backgroundColor: CHART_COLORS.positive, borderRadius: 2,
            barPercentage: 0.55, categoryPercentage: 0.6,
          },
        ],
      },
      options: baseBarOpts(),
    });
    return () => chart.destroy();
  }, [months, hasFlow]);

  // cumulative collections line
  useEffect(() => {
    if (!months || !trendRef.current || !hasFlow) return;
    let acc = 0;
    const cum = months.map((x) => { acc += Number(x.collectedMinor) / 100; return acc; });
    const chart = new Chart(trendRef.current, {
      type: 'line',
      data: {
        labels: months.map((x) => `${x.month.slice(5)}/${x.month.slice(2, 4)}`),
        datasets: [{
          label: 'Cumulative collected',
          data: cum,
          borderColor: CHART_COLORS.action,
          backgroundColor: 'rgba(26,79,191,0.08)',
          fill: true, tension: 0.35, pointRadius: 2.5,
          pointBackgroundColor: '#fff', pointBorderColor: CHART_COLORS.action,
          pointBorderWidth: 2,
        }],
      },
      options: baseBarOpts(),
    });
    return () => chart.destroy();
  }, [months, hasFlow]);

  // PAR horizontal bar
  useEffect(() => {
    if (!par || !parRef.current || !hasPar) return;
    const b = par.buckets;
    const chart = new Chart(parRef.current, {
      type: 'bar',
      data: {
        labels: ['Current', '1-30d', '31-60d', '61-90d', '90d+'],
        datasets: [{
          data: [
            Number(b['current'] ?? 0) / 100,
            Number(b['d1_30'] ?? 0) / 100,
            Number(b['d31_60'] ?? 0) / 100,
            Number(b['d61_90'] ?? 0) / 100,
            Number(b['d90p'] ?? 0) / 100,
          ],
          backgroundColor: ['#2E7D32', CHART_COLORS.warn, '#F57C00', CHART_COLORS.deep, CHART_COLORS.risk],
          borderRadius: 2, barPercentage: 0.7,
        }],
      },
      options: {
        indexAxis: 'y' as const,
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: '#ECECEC' }, border: { display: false },
            ticks: { color: '#888', callback: (v: string | number) => `K${(Number(v) / 1000).toFixed(0)}k` },
          },
          y: { grid: { display: false }, ticks: { color: '#3A4050' } },
        },
      },
    });
    return () => chart.destroy();
  }, [par, hasPar]);

  if (error) return <ErrorBox message={error} />;

  // ── loading skeleton ──
  if (!months || !summary || !par) {
    return (
      <div>
        <PageHeadSkeleton action={false} />
        <StatBandSkeleton cols={4} />
        <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3.5">
            <ChartCardSkeleton height={250} />
            <ChartCardSkeleton height={220} />
          </div>
          <div className="space-y-3.5">
            <ChartCardSkeleton height={230} />
            <BandCardSkeleton title="w-32">
              <ListSkeleton rows={3} trailing pad="px-3.5 pb-3" />
            </BandCardSkeleton>
          </div>
        </div>
      </div>
    );
  }

  const parColor = (pct: number) =>
    pct > 10 ? CHART_COLORS.risk : pct > 5 ? CHART_COLORS.warn : '#2E7D32';

  const breakdown = [
    { id: 'a', label: 'Active loans', value: summary.counts.active, color: '#2E7D32' },
    { id: 'o', label: 'Overdue loans', value: summary.counts.overdue, color: '#C62828' },
    { id: 'c', label: 'Cleared loans', value: summary.counts.cleared, color: '#1A4FBF' },
  ];

  return (
    <div>
      <PageActionBar
        title="Reports"
        sub="Portfolio performance and risk, updated live"
        actions={
          <a
            href={`${api.defaults.baseURL}/reports/loans.csv`}
            className="inline-flex h-[30px] items-center rounded-[3px] border border-brand-600 px-3.5 text-[10.5px] font-extrabold uppercase tracking-wide text-brand-600 hover:bg-brand-50"
          >
            Export CSV
          </a>
        }
      />

      <StatBand
        cols={4}
        items={[
          { label: 'Active', value: String(summary.counts.active), color: '#2E7D32' },
          { label: 'Overdue', value: String(summary.counts.overdue), color: '#C62828' },
          { label: 'Cleared', value: String(summary.counts.cleared) },
          { label: 'Outstanding', value: money(summary.outstandingMinor) },
        ]}
      />

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3.5">
          <ChartCard title="Disbursed vs Collected · last 6 months">
            {hasFlow
              ? <canvas ref={barRef} />
              : <ChartEmpty icon={<FiBarChart2 size={18} />} label="No disbursements or collections in the last 6 months" />}
          </ChartCard>
          <ChartCard title="Collections trend · cumulative" height={220}>
            {hasFlow
              ? <canvas ref={trendRef} />
              : <ChartEmpty icon={<FiTrendingUp size={18} />} label="No collections recorded yet" />}
          </ChartCard>
        </div>

        <div className="space-y-3.5">
          <ChartCard
            title="Portfolio at Risk · aging"
            height={230}
            right={hasPar ? (
              <span style={{ fontSize: 11, fontWeight: 800, color: parColor(par.par30Pct) }}>
                PAR-30 {par.par30Pct.toFixed(1)}%
              </span>
            ) : undefined}
          >
            {hasPar
              ? <canvas ref={parRef} />
              : <ChartEmpty icon={<FiPieChart size={18} />} label="Nothing outstanding — portfolio is current" />}
          </ChartCard>

          <div className="overflow-hidden rounded-card border border-line bg-white">
            <div className="band"><span className="t">Loan Breakdown</span></div>
            <div className="px-3.5 pb-3">
              {breakdown.map((r) => (
                <div key={r.id}
                  className="flex items-center justify-between border-b border-line-2 py-2.5 text-[12px] last:border-none">
                  <span className="flex items-center gap-2 text-ink-2">
                    <i className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                    {r.label}
                  </span>
                  <b className="tabular-nums">{r.value}</b>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
