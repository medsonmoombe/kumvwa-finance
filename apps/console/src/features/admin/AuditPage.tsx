import { useEffect, useState } from 'react';
import { FiActivity } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { Badge, ErrorBox } from '../../components/ui';
import {
  AppTable, PageActionBar, StatBand, StatBandSkeleton, type Column,
} from '../../components/kit';
import { api } from '../../lib/api';
import { date } from '../../lib/format';

export interface AdminAuditEvent {
  id: string;
  actor: string;
  actorRole: string;
  tenantId: string | null;
  tenantName: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  severity: 'info' | 'warn' | 'critical';
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

interface Stats { total: number; today: number; critical: number; warn: number }

const SEV_COLOR: Record<string, 'green' | 'yellow' | 'red' | 'grey'> = {
  info: 'green', warn: 'yellow', critical: 'red',
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warn', label: 'Warn' },
  { value: 'info', label: 'Info' },
];

export function AuditPage() {
  const nav = useNavigate();
  const [events, setEvents] = useState<AdminAuditEvent[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  function load(sev = filter) {
    setEvents(null);
    Promise.all([
      api.get<{ items: AdminAuditEvent[] }>('/admin/audit', {
        params: { ...(sev ? { severity: sev } : {}), limit: 200 },
      }),
      api.get<Stats>('/admin/audit/stats'),
    ])
      .then(([e, s]) => { setEvents(e.data.items); setStats(s.data); })
      .catch(() => setError('Could not load audit log'));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const cols: Array<Column<AdminAuditEvent>> = [
    {
      key: 'sev', header: 'Severity', width: '80px',
      render: (e) => <Badge color={SEV_COLOR[e.severity] ?? 'grey'} dot>{e.severity}</Badge>,
    },
    {
      key: 'actor', header: 'Actor',
      render: (e) => (
        <div>
          <b className="block font-semibold">{e.actor}</b>
          <span className="text-[10.5px] capitalize text-ink-muted">
            {e.actorRole.replaceAll('_', ' ')}
          </span>
        </div>
      ),
    },
    {
      key: 'tenant', header: 'Tenant',
      render: (e) => e.tenantName
        ? <span className="text-[11.5px]">{e.tenantName}</span>
        : <span className="text-ink-muted">Platform</span>,
    },
    {
      key: 'action', header: 'Action',
      render: (e) => (
        <div>
          <b className="block font-semibold">{e.action.replaceAll('_', ' ')}</b>
          <span className="text-[10.5px] text-ink-muted">
            {e.resource}{e.resourceId ? ` · ${e.resourceId.slice(0, 8)}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'ip', header: 'IP',
      render: (e) => (
        <span className="font-mono text-[11px] text-ink-muted">{e.ip ?? '—'}</span>
      ),
    },
    {
      key: 'ts', header: 'Time',
      render: (e) => (
        <span className="text-[11px] text-ink-muted">{date(e.createdAt)}</span>
      ),
    },
  ];

  if (error) return <ErrorBox message={error} />;

  return (
    <div>
      <PageActionBar
        title="Platform Audit Log"
        sub="Every privileged action across all tenants and platform admins"
        actions={<FiActivity size={15} className="text-ink-muted" />}
      />

      {!stats ? (
        <StatBandSkeleton cols={4} />
      ) : (
        <StatBand
          cols={4}
          items={[
            { label: 'Total events', value: String(stats.total) },
            { label: 'Today', value: String(stats.today) },
            {
              label: 'Warnings', value: String(stats.warn),
              color: stats.warn > 0 ? '#B26A00' : undefined,
            },
            {
              label: 'Critical', value: String(stats.critical),
              color: stats.critical > 0 ? '#C62828' : undefined,
            },
          ]}
        />
      )}

      <AppTable
        columns={cols}
        rows={events}
        searchKeys={['actor', 'actorRole', 'action', 'resource', 'resourceId', 'severity', 'tenantName', 'ip']}
        filters={FILTERS}
        activeFilter={filter}
        onFilterChange={(v) => { setFilter(v); load(v); }}
        onRefresh={() => load()}
        onRowClick={(e) => nav(`/admin/audit/${e.id}`)}
        empty="No audit events match the current filter"
      />
    </div>
  );
}
