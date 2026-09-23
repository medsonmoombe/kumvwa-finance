import { useCallback, useEffect, useState } from 'react';
import { FiChevronRight, FiFolder, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import {
  Avatar,
  Badge,
  Card,
  CenteredSpinner,
  Empty,
  ErrorBox,
  PageHead,
  ProgressBar,
} from '../../components/ui';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';

interface LoanRow {
  id: string;
  clientName: string;
  clientPhone: string;
  status: string;
  termCount: number;
  principalMinor: string;
  totalDueMinor: string;
  paidAmountMinor: string;
  outstandingMinor: string;
  nextDueDate: string | null;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cleared', label: 'Cleared' },
];

const statusColor: Record<string, 'green' | 'red' | 'blue' | 'grey'> = {
  active: 'green',
  overdue: 'red',
  cleared: 'blue',
  defaulted: 'grey',
};

export function LoansPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<LoanRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .get<{ items: LoanRow[] }>('/loans', {
        params: {
          ...(status ? { status } : {}),
          ...(q.trim() ? { q: q.trim() } : {}),
        },
      })
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load loans'));
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHead title="Loans" sub={items ? `${items.length} shown` : undefined} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* segmented control */}
        <div className="flex rounded-[10px] border-[1.5px] border-line bg-white p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatus(f.value)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                status === f.value
                  ? 'bg-brand-600 text-white'
                  : 'text-ink-2 hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-[280px]">
          <FiSearch
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            className="w-full rounded-input border-[1.5px] border-line bg-white py-2.5 pl-10 pr-4 text-[13px] outline-none focus:border-brand-500"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search client, phone or loan id…"
          />
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {!items ? (
        <CenteredSpinner />
      ) : items.length === 0 ? (
        <Card>
          <Empty
            icon={<FiFolder />}
            title="No loans in this view"
            hint="Approve client requests to create loans"
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFBFD] text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Loan</th>
                <th className="px-4 py-2.5 text-right">Outstanding</th>
                <th className="px-4 py-2.5">Progress</th>
                <th className="px-4 py-2.5">Next due</th>
                <th className="px-4 py-2.5 text-right">Status</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map((l) => {
                const paid = Number(l.paidAmountMinor);
                const total = Number(l.totalDueMinor) || 1;
                return (
                  <tr
                    key={l.id}
                    onClick={() => nav(`/loans/${l.id}`)}
                    className="cursor-pointer border-t border-line-2 text-[12.5px] hover:bg-[#FAFBFE]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={l.clientName} size={30} />
                        <div>
                          <b className="font-semibold">{l.clientName}</b>
                          <div className="text-[10.5px] tabular-nums text-ink-muted">
                            {l.clientPhone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-mono text-[11px] text-ink-2">
                        {l.id.slice(0, 12)}…
                      </span>
                      <span className="text-[10.5px] text-ink-muted">
                        {l.termCount} mo
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-display font-bold tabular-nums">
                      {money(l.outstandingMinor)}
                    </td>
                    <td className="w-[110px] px-4 py-3">
                      <ProgressBar
                        pct={(paid / total) * 100}
                        danger={l.status === 'overdue'}
                      />
                    </td>
                    <td className="px-4 py-3 text-[11.5px] tabular-nums text-ink-2">
                      {l.nextDueDate ? date(l.nextDueDate) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge color={statusColor[l.status] ?? 'grey'} dot>
                        {l.status}
                      </Badge>
                    </td>
                    <td className="px-1">
                      <FiChevronRight
                        size={14}
                        className="text-ink-muted"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
