import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Avatar, Badge, ErrorBox } from '../../components/ui';
import { DataGrid, StatBand, StatBandSkeleton, type Column } from '../../components/kit';
import { api } from '../../lib/api';
import { date, money } from '../../lib/format';

interface Req {
  id: string; clientId: string; clientName: string; phone: string;
  amountMinor: string; termCount: number; purpose: string;
  status: 'pending' | 'approved' | 'rejected'; feedback: string | null;
  requestedAt: string; loanId: string | null;
}

const statusColor = { pending: 'amber', approved: 'green', rejected: 'red' } as const;

export function RequestsPage() {
  const [items, setItems] = useState<Req[] | null>(null);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const load = useCallback(() => {
    api.get<{ items: Req[] }>('/loan-requests/inbox')
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load requests'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const pending = items?.filter((r) => r.status === 'pending').length ?? 0;
  const approved = items?.filter((r) => r.status === 'approved').length ?? 0;
  const rejected = items?.filter((r) => r.status === 'rejected').length ?? 0;
  const pendingValue = items
    ?.filter((r) => r.status === 'pending')
    .reduce((a, r) => a + BigInt(r.amountMinor), 0n).toString() ?? '0';

  const columns: Array<Column<Req>> = [
    {
      key: 'c', header: 'Applicant', width: '26%',
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={r.clientName} size={28}
            tone={r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'brand'} />
          <div>
            <b className="block font-semibold">{r.clientName}</b>
            <span className="text-[10.5px] tabular-nums text-ink-muted">{r.phone}</span>
          </div>
        </div>
      ),
    },
    { key: 'a', header: 'Amount', render: (r) => <b className="font-display tabular-nums">{money(r.amountMinor)}</b> },
    { key: 't', header: 'Term', render: (r) => <span className="tabular-nums">{r.termCount} mo</span> },
    {
      key: 'p', header: 'Purpose',
      render: (r) => <span className="block max-w-[200px] truncate text-ink-2">{r.purpose}</span>,
    },
    { key: 'd', header: 'Requested', render: (r) => <span className="text-[11px] text-ink-muted">{date(r.requestedAt)}</span> },
    {
      key: 's', header: 'Status',
      render: (r) => <Badge color={statusColor[r.status]} dot>{r.status}</Badge>,
    },
  ];

  return (
    <div>
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {items ? (
        <StatBand
          cols={4}
          items={[
            { label: 'Pending review', value: String(pending), color: pending > 0 ? '#B26A00' : '#2E7D32' },
            { label: 'Pending value', value: money(pendingValue) },
            { label: 'Approved', value: String(approved), color: '#2E7D32' },
            { label: 'Declined', value: String(rejected), color: '#C02828' },
          ]}
        />
      ) : (
        <StatBandSkeleton cols={4} />
      )}

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
        <div className="band">
          <span className="t">Loan Requests</span>
          <span className="ml-auto text-[9.5px] text-ink-muted">
            approving creates the loan atomically · declining requires feedback
          </span>
        </div>
        <DataGrid
          columns={columns}
          rows={items}
          onRowClick={(r) => nav(`/requests/${r.id}`)}
          empty="No loan requests yet. Client applications appear here for review."
        />
      </div>
    </div>
  );
}
