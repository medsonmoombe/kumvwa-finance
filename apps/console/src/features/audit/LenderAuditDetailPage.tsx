import { useEffect, useState, type ReactNode } from 'react';
import { FiAlertTriangle, FiInfo, FiZap } from 'react-icons/fi';
import { Link, useParams } from 'react-router-dom';

import { Badge, ErrorBox } from '../../components/ui';
import { DetailPageSkeleton, PageActionBar, StatBand } from '../../components/kit';
import { api } from '../../lib/api';
import { date } from '../../lib/format';
import type { LenderAuditEvent } from './LenderAuditPage';

type LenderAuditEventWithDesc = LenderAuditEvent & { description: string | null };

const SEV_COLOR: Record<string, 'green' | 'yellow' | 'red'> = {
  info: 'green', warn: 'yellow', critical: 'red',
};

const SEV_ICON: Record<string, ReactNode> = {
  info: <FiInfo size={16} className="text-accent-600" />,
  warn: <FiAlertTriangle size={16} className="text-amber-500" />,
  critical: <FiZap size={16} className="text-danger-500" />,
};

const SEV_BG: Record<string, string> = {
  info: 'bg-accent-50 border-accent-200',
  warn: 'bg-amber-50 border-amber-200',
  critical: 'bg-danger-50 border-danger-200',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-line-2 py-2.5 last:border-none">
      <span className="w-[130px] shrink-0 text-[11px] font-semibold text-ink-muted">{label}</span>
      <span className="min-w-0 break-all text-[12px] font-medium text-ink">{value || '—'}</span>
    </div>
  );
}

export function LenderAuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<LenderAuditEventWithDesc | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    api.get<LenderAuditEventWithDesc>(`/audit/${id}`)
      .then((r) => setEvent(r.data))
      .catch(() => setError('Could not load audit event'));
  }, [id]);

  if (error) return <ErrorBox message={error} />;
  if (!event) return <DetailPageSkeleton cols={4} fields={5} />;

  return (
    <div>
      <Link
        to="/audit"
        className="mb-3 inline-block text-[12px] font-semibold text-ink-muted hover:text-ink"
      >
        ← Audit log
      </Link>

      <PageActionBar
        title={event.action.replaceAll('_', ' ')}
        sub={`${event.resource}${event.resourceId ? ` · ${event.resourceId}` : ''} · ${date(event.createdAt)}`}
        actions={
          <Badge color={SEV_COLOR[event.severity] ?? 'grey'} dot>
            {event.severity}
          </Badge>
        }
      />

      <StatBand
        cols={4}
        items={[
          { label: 'Actor', value: event.actor },
          { label: 'Role', value: event.actorRole.replaceAll('_', ' ') },
          { label: 'Resource', value: event.resource },
          { label: 'IP address', value: event.ip ?? '—' },
        ]}
      />

      {/* severity banner */}
      <div
        className={`mb-3.5 flex items-center gap-3 rounded-card border px-4 py-3 ${SEV_BG[event.severity] ?? 'bg-[#F5F6F8] border-line'}`}
      >
        {SEV_ICON[event.severity]}
        <div className="min-w-0">
          <b className="block text-[12.5px] font-bold capitalize text-ink">
            {event.severity} event
          </b>
          <span className="text-[11px] text-ink-2">
            Recorded at {date(event.createdAt)} from {event.ip ?? 'unknown IP'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[1fr_360px]">
        {/* event details */}
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
          <div className="band"><span className="t">Event Details</span></div>
          <div className="px-4 py-1">
            {event.description && (
              <Row label="Description" value={event.description} />
            )}
            <Row label="Action" value={event.action} />
            <Row label="Resource" value={event.resource} />
            <Row label="Resource ID" value={event.resourceId ?? '—'} />
            <Row label="Actor" value={event.actor} />
            <Row label="Actor role" value={event.actorRole} />
            <Row label="IP address" value={event.ip ?? '—'} />
            <Row label="Timestamp" value={date(event.createdAt)} />
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-3.5">
          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band"><span className="t">Client</span></div>
            <div className="px-4 py-1">
              <Row label="User agent" value={event.userAgent ?? '—'} />
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
            <div className="band">
              <span className="t">Payload</span>
              <span className="ml-auto text-[9.5px] text-ink-muted">raw event metadata</span>
            </div>
            <div className="p-3.5">
              {event.meta && Object.keys(event.meta).length > 0 ? (
                <pre className="overflow-x-auto rounded-[3px] bg-[#F5F6F8] p-3 text-[10.5px] leading-relaxed text-ink-2">
                  {JSON.stringify(event.meta, null, 2)}
                </pre>
              ) : (
                <p className="text-[11.5px] text-ink-muted">
                  No additional metadata for this event.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
