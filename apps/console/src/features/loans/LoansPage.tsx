import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch } from 'react-icons/fi';

import { Badge, ErrorBox } from '../../components/ui';
import {
  DataGrid, PageActionBar, StatBand, StatBandSkeleton, type Column,
} from '../../components/kit';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';

interface LoanRow {
  id: string; loanRef: string; clientName?: string; status: string;
  principalMinor: string; totalDueMinor: string; paidAmountMinor: string;
  termCount: number; rateBps: number; nextDueDate: string | null;
  repaymentStructure: string; rolloverCount: number;
}

const statusColor: Record<string, 'green' | 'red' | 'blue' | 'grey'> = {
  active: 'green', overdue: 'red', cleared: 'blue', defaulted: 'grey',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cleared', label: 'Cleared' },
];

export function LoansPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<LoanRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.get<{ items: LoanRow[] }>('/loans', {
      params: { ...(status ? { status } : {}), ...(q.trim() ? { q: q.trim() } : {}) },
    })
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load loans'));
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const active = items?.filter((l) => l.status === 'active').length ?? 0;
  const overdue = items?.filter((l) => l.status === 'overdue').length ?? 0;
  const totalOut = items?.reduce(
    (a, l) => a + BigInt(l.totalDueMinor) - BigInt(l.paidAmountMinor), 0n,
  ).toString() ?? '0';

  const columns: Array<Column<LoanRow>> = [
    {
      key: 'c', header: 'Client', width: '24%',
      render: (l) => (
        <div>
          <b className="block font-semibold">{l.clientName ?? '—'}</b>
          <span className="text-[10.5px] tabular-nums text-ink-muted">{l.loanRef}</span>
        </div>
      ),
    },
    { key: 'p', header: 'Principal', render: (l) => <b className="tabular-nums">{money(l.principalMinor)}</b> },
    {
      key: 'o', header: 'Outstanding',
      render: (l) => (
        <b className="tabular-nums">
          {money((BigInt(l.totalDueMinor) - BigInt(l.paidAmountMinor)).toString())}
        </b>
      ),
    },
    {
      key: 'pr', header: 'Progress', width: '14%',
      render: (l) => {
        const pct = Math.min(100,
          (Number(l.paidAmountMinor) / Math.max(1, Number(l.totalDueMinor))) * 100);
        return (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-brand-500"
                style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[9px] tabular-nums text-ink-muted">{pct.toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      key: 't', header: 'Terms',
      render: (l) => (
        <span className="text-[11px] text-ink-2">
          {(l.rateBps / 100).toFixed(0)}% · {l.repaymentStructure === 'bullet' ? 'bullet' : `${l.termCount} inst`}
          {l.rolloverCount > 0 && <span className="ml-1 text-amber-500">+{l.rolloverCount} ext</span>}
        </span>
      ),
    },
    {
      key: 'n', header: 'Next due',
      render: (l) => <span className="text-[11px] text-ink-muted">{l.nextDueDate ? date(l.nextDueDate) : '—'}</span>,
    },
    {
      key: 'st', header: 'Status',
      render: (l) => <Badge color={statusColor[l.status] ?? 'grey'} dot>{l.status}</Badge>,
    },
  ];

  return (
    <div>
      <PageActionBar
        title="Loans"
        sub={items ? `${items.length} shown` : undefined}
        actions={
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.value} onClick={() => setStatus(f.value)}
                className={`rounded-[3px] px-2.5 py-1 text-[10.5px] font-bold transition-colors ${
                  status === f.value
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-white text-ink-2 hover:text-ink'
                }`}>
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {items ? (
        <StatBand
          cols={4}
          items={[
            { label: 'Active', value: String(active), color: '#2E7D32' },
            { label: 'Overdue', value: String(overdue), color: '#C02828' },
            { label: 'Total shown', value: String(items.length) },
            { label: 'Outstanding', value: money(totalOut) },
          ]}
        />
      ) : (
        <StatBandSkeleton cols={4} />
      )}

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
        <div className="band">
          <span className="t">Loan Portfolio</span>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <FiSearch size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                className="h-[26px] rounded-[3px] border border-line bg-white pl-7 pr-3 text-[11px] outline-none focus:border-brand-500"
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
              />
            </div>
          </div>
        </div>
        <DataGrid
          columns={columns}
          rows={items}
          onRowClick={(l) => nav(`/loans/${l.id}`)}
          empty="No loans in this view. Approve client requests to create loans."
        />
      </div>
    </div>
  );
}
