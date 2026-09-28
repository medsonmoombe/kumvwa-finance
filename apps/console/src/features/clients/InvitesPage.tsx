import { useCallback, useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { Badge, ErrorBox } from '../../components/ui';
import {
  AppTable, Drawer, PageActionBar, Pill, StatBand, StatBandSkeleton,
  type Column, type FilterOption,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';
import { InviteForm } from './ClientsPage';

export interface InviteRow {
  id: string;
  clientId: string | null;
  clientName: string;
  phone: string;
  status: string;
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  pending: 'amber', completed: 'green', expired: 'grey', cancelled: 'red',
};

const FILTERS: FilterOption[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
];

export function InvitesPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<InviteRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get<{ items: InviteRow[] }>('/invites', { params: filter ? { status: filter } : {} })
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load invites'));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const pending   = items?.filter((i) => i.status === 'pending').length ?? 0;
  const completed = items?.filter((i) => i.status === 'completed').length ?? 0;
  const expired   = items?.filter((i) => i.status === 'expired').length ?? 0;

  const columns: Array<Column<InviteRow>> = [
    {
      key: 'client', header: 'Client', width: '28%',
      render: (i) => (
        <div>
          <b className="block font-semibold">{i.clientName}</b>
          <span className="tabular-nums text-[10.5px] text-ink-muted">{i.phone}</span>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status',
      render: (i) => <Badge color={STATUS_COLOR[i.status] ?? 'grey'} dot>{i.status}</Badge>,
    },
    {
      key: 'created', header: 'Invited',
      render: (i) => <span className="text-[11px] text-ink-muted">{date(i.createdAt)}</span>,
    },
    {
      key: 'expires', header: 'Expires / Completed',
      render: (i) => (
        <span className="text-[11px] text-ink-muted">
          {i.completedAt ? `Completed ${date(i.completedAt)}` : date(i.expiresAt)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageActionBar
        title="Invites"
        sub={items ? `${items.length} total · ${pending} pending` : undefined}
        actions={
          <Pill onClick={() => setInviting(true)}>
            <FiPlus size={11} /> Invite Client
          </Pill>
        }
      />

      {items ? (
        <StatBand
          cols={4}
          items={[
            { label: 'Total', value: String(items.length) },
            { label: 'Pending', value: String(pending), color: pending > 0 ? '#B45309' : undefined },
            { label: 'Completed', value: String(completed), color: '#2E7D32' },
            { label: 'Expired', value: String(expired) },
          ]}
        />
      ) : (
        <StatBandSkeleton cols={4} />
      )}

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <AppTable
        columns={columns}
        rows={items}
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={setFilter}
        onRefresh={load}
        onRowClick={(row) => nav(`/invites/${row.id}`)}
        actions={(row) => [
          ...(row.status === 'pending' ? [{ label: 'Resend invite', onClick: (r: InviteRow) => nav(`/invites/${r.id}?resend=1`) }] : []),
          ...(row.clientId ? [{ label: 'View client', onClick: (r: InviteRow) => nav(`/clients/${r.clientId}`) }] : []),
        ]}
        empty="No invites yet. Invite your first borrower."
        pageSize={25}
      />

      <Drawer
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a Client"
        sub="The client receives an invite code to redeem in the app."
      >
        <InviteForm onDone={() => { setInviting(false); load(); }} />
      </Drawer>
    </div>
  );
}
