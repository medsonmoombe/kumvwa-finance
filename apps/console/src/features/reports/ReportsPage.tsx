import { useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';

import { Card, CardHead, CenteredSpinner, ErrorBox, PageHead } from '../../components/ui';
import { api } from '../../lib/api';
import { money } from '../../lib/format';

interface Month {
  month: string;
  disbursedMinor: string;
  collectedMinor: string;
}
interface Summary {
  counts: { active: number; overdue: number; cleared: number };
  outstandingMinor: string;
  disbursedMinor: string;
  dueThisMonthMinor: string;
  collectedThisMonthMinor: string;
  clientsCount: number;
}

export function ReportsPage() {
  const [months, setMonths] = useState<Month[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Month[]>('/reports/monthly'),
      api.get<Summary>('/reports/summary'),
    ])
      .then(([m, s]) => {
        setMonths(m.data);
        setSummary(s.data);
      })
      .catch(() => setError('Could not load reports'));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!months || !summary) return <CenteredSpinner />;

  const max = Math.max(
    1,
    ...months.flatMap((m) => [
      Number(m.disbursedMinor),
      Number(m.collectedMinor),
    ]),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead
        title="Reports"
        sub="Portfolio performance over the last 6 months"
        action={
          <a
            href={`${api.defaults.baseURL}/reports/loans.csv`}
            className="flex items-center gap-2 rounded-btn bg-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-c1 hover:bg-brand-900"
          >
            <FiDownload size={14} /> Export CSV
          </a>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4">
          <div className="text-[10.5px] font-semibold text-ink-muted">Due this month</div>
          <div className="mt-1 font-display text-[21px] font-bold tabular-nums">
            {money(summary.dueThisMonthMinor)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10.5px] font-semibold text-ink-muted">Collected this month</div>
          <div className="mt-1 font-display text-[21px] font-bold tabular-nums text-accent-700">
            {money(summary.collectedThisMonthMinor)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10.5px] font-semibold text-ink-muted">Disbursed (6 mo)</div>
          <div className="mt-1 font-display text-[21px] font-bold tabular-nums">
            {money(summary.disbursedMinor)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-[10.5px] font-semibold text-ink-muted">Outstanding</div>
          <div className="mt-1 font-display text-[21px] font-bold tabular-nums text-danger-500">
            {money(summary.outstandingMinor)}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead
          title="Disbursed vs Collected"
          right={
            <div className="flex gap-3 text-[10.5px] font-semibold text-ink-2">
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-sm bg-brand-500" /> Disbursed
              </span>
              <span className="flex items-center gap-1.5">
                <i className="h-2 w-2 rounded-sm bg-accent-500" /> Collected
              </span>
            </div>
          }
        />
        <div className="px-4 pb-4 pt-5">
          <div className="flex h-[180px] items-end gap-3">
            {months.map((m) => {
              const d = Number(m.disbursedMinor);
              const c = Number(m.collectedMinor);
              return (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-[150px] w-full items-end justify-center gap-1">
                    <div
                      title={`Disbursed ${money(m.disbursedMinor)}`}
                      className="w-3.5 rounded-t bg-brand-500"
                      style={{ height: `${Math.max(2, (d / max) * 145)}px` }}
                    />
                    <div
                      title={`Collected ${money(m.collectedMinor)}`}
                      className="w-3.5 rounded-t bg-accent-500"
                      style={{ height: `${Math.max(2, (c / max) * 145)}px` }}
                    />
                  </div>
                  <span className="text-[9.5px] text-gray-400">
                    {m.month.slice(5)}/{m.month.slice(2, 4)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
