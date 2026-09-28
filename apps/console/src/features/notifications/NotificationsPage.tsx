import { useCallback, useEffect, useState } from 'react';
import { FiBell, FiCheck } from 'react-icons/fi';

import { ErrorBox } from '../../components/ui';
import { PageActionBar, Pill } from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_COLOR: Record<string, string> = {
  verification: '#1A4FBF',
  loan: '#2E7D32',
  repayment: '#2E7D32',
  overdue: '#C62828',
  invite: '#B45309',
  system: '#6B7280',
};

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(() => {
    setError('');
    api.get<{ items: NotificationRow[]; unread: number }>('/notifications', { params: { limit: 50 } })
      .then((r) => { setItems(r.data.items); setUnread(r.data.unread); })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setItems((prev) => prev?.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n) ?? null);
    setUnread((u) => Math.max(0, u - 1));
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await api.post('/notifications/read-all');
      setItems((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
      setUnread(0);
    } catch (e) { setError(apiError(e)); }
    finally { setMarkingAll(false); }
  }

  return (
    <div>
      <PageActionBar
        title="Notifications"
        sub={unread > 0 ? `${unread} unread` : 'All caught up'}
        actions={
          unread > 0 ? (
            <Pill tone="ghost" onClick={() => void markAllRead()} disabled={markingAll}>
              <FiCheck size={11} /> {markingAll ? 'Marking…' : 'Mark all read'}
            </Pill>
          ) : undefined
        }
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <div className="overflow-hidden rounded-card border border-line bg-white">
        {!items ? (
          <div className="divide-y divide-line-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 px-4 py-3.5">
                <div className="mt-0.5 h-7 w-7 shrink-0 animate-pulse rounded-full bg-[#E9ECF1]" />
                <div className="flex-1 space-y-2">
                  <div className="h-2.5 w-40 animate-pulse rounded bg-[#E9ECF1]" />
                  <div className="h-2 w-64 animate-pulse rounded bg-[#E9ECF1]" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-ink-muted">
            <FiBell size={28} className="opacity-30" />
            <p className="text-[12px]">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-line-2">
            {items.map((n) => (
              <div
                key={n.id}
                onClick={() => { if (!n.readAt) void markRead(n.id); }}
                className={`flex cursor-pointer gap-3 px-4 py-3.5 transition-colors hover:bg-[#F5F8FE] ${
                  !n.readAt ? 'bg-[#F0F5FF]' : ''
                }`}
              >
                <div
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: TYPE_COLOR[n.type] ?? '#6B7280' }}
                >
                  <FiBell size={13} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <b className={`block text-[12.5px] leading-snug ${!n.readAt ? 'text-ink' : 'text-ink-2'}`}>
                      {n.title}
                    </b>
                    <span className="shrink-0 text-[10px] text-ink-muted">{date(n.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{n.body}</p>
                </div>
                {!n.readAt && (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
