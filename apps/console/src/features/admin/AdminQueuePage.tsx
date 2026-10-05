import { useCallback, useEffect, useState } from 'react';
import { FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  AppTable, Drawer, PageActionBar, Pill,
  type Column, type FilterOption,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface TenantRow {
  id: string; name: string; type: string; status: string;
  verificationNote: string | null; bozSubmittedAt: string | null;
  bozFile: { id: string; mime: string; size: number } | null;
  ownerPhone: string | null; ownerName: string | null; createdAt: string;
  review?: { canApprove: boolean; blockers: string[] };
}

const FILTERS: FilterOption[] = [
  { value: '', label: 'All' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'grey'> = {
  active: 'green', pending_verification: 'amber', rejected: 'red',
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

// ── Main page ──────────────────────────────────────────────────────────────

export function AdminQueuePage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<'queue' | 'terms'>('queue');
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [nrc, setNrc] = useState<Record<string, string>>({});

  // drawer state
  const [drawer, setDrawer] = useState<TenantRow | null>(null);

  const load = useCallback(() => {
    setError('');
    api.get<TenantRow[]>('/admin/tenants', { params: filter ? { status: filter } : {} })
      .then((r) => setRows(r.data))
      .catch(() => setError('Could not load the verification queue'));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, decision: 'approve' | 'reject') {
    if (busyId) return;
    setBusyId(id); setError('');
    try {
      await api.patch(`/admin/tenants/${id}/verification`, {
        decision,
        ...(decision === 'reject' ? { reason: note[id] ?? '' } : {}),
      });
      load();
      if (drawer?.id === id) setDrawer(null);
    } catch (e) { setError(apiError(e)); }
    finally { setBusyId(''); }
  }

  async function viewCert(fileId: string) {
    try {
      const res = await api.get<{ downloadUrl: string }>(`/files/${fileId}/download-url`);
      window.open(res.data.downloadUrl, '_blank', 'noopener');
    } catch (e) { setError(apiError(e)); }
  }

  async function revealNrc(id: string) {
    try {
      const res = await api.get<{ ownerNrc: string | null }>(`/admin/tenants/${id}/identity`);
      setNrc((prev) => ({ ...prev, [id]: res.data.ownerNrc ?? '—' }));
    } catch (e) { setError(apiError(e)); }
  }

  const pending = rows?.filter((r) => r.status === 'pending_verification').length ?? 0;

  const columns: Array<Column<TenantRow>> = [
    {
      key: 'name', header: 'Business', width: '30%',
      render: (t) => (
        <div>
          <b className="block font-semibold">{t.name}</b>
          <span className="text-[10.5px] text-ink-muted capitalize">{t.type}</span>
        </div>
      ),
    },
    {
      key: 'owner', header: 'Owner',
      render: (t) => (
        <div>
          <span className="block text-[12px]">{t.ownerName ?? '—'}</span>
          <span className="tabular-nums text-[10.5px] text-ink-muted">{t.ownerPhone ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'submitted', header: 'Submitted',
      render: (t) => (
        <span className="text-[11px] text-ink-muted">
          {t.bozSubmittedAt ? date(t.bozSubmittedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'cert', header: 'Certificate',
      render: (t) => t.bozFile ? (
        <button onClick={(e) => { e.stopPropagation(); void viewCert(t.bozFile!.id); }}
          className="flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:underline">
          <FiFileText size={11} /> {formatBytes(t.bozFile.size)}
        </button>
      ) : <span className="text-[11px] text-ink-muted">None</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (t) => (
        <Badge color={STATUS_COLOR[t.status] ?? 'grey'} dot>
          {t.status.replaceAll('_', ' ')}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageActionBar
        title="Verification Queue"
        sub={`${pending} awaiting review · ${rows?.length ?? 0} total`}
        actions={
          <div className="flex gap-0 rounded-[3px] border border-line overflow-hidden">
            {(['queue', 'terms'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-[10.5px] font-bold transition-colors ${
                  tab === t ? 'bg-brand-600 text-white' : 'bg-white text-ink-2 hover:text-ink'
                }`}>
                {t === 'queue' ? 'Queue' : 'Platform Terms'}
              </button>
            ))}
          </div>
        }
      />

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      {tab === 'terms' ? (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="p-4">
            <p className="text-[12px] text-ink-muted">
              Platform Terms now live with the rest of the platform configuration.
            </p>
            <Pill onClick={() => nav('/admin/settings?tab=terms')}>Open Platform Settings</Pill>
          </div>
        </div>
      ) : (
        <AppTable
          columns={columns}
          rows={rows}
          searchKeys={['name', 'type', 'status', 'ownerName', 'ownerPhone']}
          filters={FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          onRefresh={load}
          onRowClick={(t) => nav(`/admin/tenants/${t.id}`)}
          actions={(t) => [
            {
              label: 'Quick view',
              onClick: (row) => setDrawer(row),
            },
            ...(t.status === 'pending_verification' ? [
              {
                label: 'Approve',
                onClick: (row: TenantRow) => void review(row.id, 'approve'),
              },
              {
                label: 'Reject',
                danger: true,
                onClick: (row: TenantRow) => setDrawer(row),
              },
            ] : []),
          ]}
          empty="Nothing in this view"
          pageSize={15}
        />
      )}

      {/* ── Quick-view drawer ── */}
      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.name ?? ''}
        sub={drawer ? `${drawer.type} · ${drawer.status.replaceAll('_', ' ')}` : undefined}
      >
        {drawer && (
          <div className="space-y-4 text-[12.5px]">
            {/* identity */}
            <div className="space-y-2">
              {[
                ['Owner', drawer.ownerName ?? '—'],
                ['Phone', drawer.ownerPhone ?? '—'],
                ['Submitted', drawer.bozSubmittedAt ? date(drawer.bozSubmittedAt) : '—'],
                ['Registered', date(drawer.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-line-2 pb-2">
                  <span className="text-ink-muted">{k}</span>
                  <b className="tabular-nums">{v}</b>
                </div>
              ))}
            </div>

            {/* NRC reveal */}
            <div>
              <div className="mb-1 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-muted">Owner NRC</div>
              {nrc[drawer.id] ? (
                <span className="rounded-[3px] bg-surface px-2.5 py-1 font-mono text-[12px]">{nrc[drawer.id]}</span>
              ) : (
                <button onClick={() => void revealNrc(drawer.id)}
                  className="text-[11.5px] font-bold text-brand-600 hover:underline">
                  Reveal (access is audited)
                </button>
              )}
            </div>

            {/* certificate */}
            {drawer.bozFile && (
              <div>
                <div className="mb-1 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-muted">BOZ Certificate</div>
                <button onClick={() => void viewCert(drawer.bozFile!.id)}
                  className="flex items-center gap-1.5 text-[11.5px] font-bold text-brand-600 hover:underline">
                  <FiFileText size={12} /> View · {formatBytes(drawer.bozFile.size)}
                </button>
              </div>
            )}

            {/* verification note */}
            {drawer.verificationNote && (
              <div className="rounded-[3px] bg-amber-50 p-3 text-[11.5px] text-amber-700">
                <b>Note sent:</b> {drawer.verificationNote}
              </div>
            )}

            {/* decision panel — only for pending */}
            {drawer.status === 'pending_verification' && (
              <div className="space-y-2.5 border-t border-line pt-4">
                <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-ink-muted">Decision</div>
                {drawer.review && !drawer.review.canApprove && drawer.review.blockers.length > 0 && (
                  <div className="rounded-[3px] border border-warn-500/30 bg-warn-50 p-2.5 text-[11px] text-warn-500">
                    <b>Cannot approve yet — missing items:</b>
                    <ul className="mt-1 list-disc pl-4">
                      {drawer.review.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <input
                  className={inputCls}
                  placeholder="Rejection note (required, min 10 chars)"
                  value={note[drawer.id] ?? ''}
                  onChange={(e) => setNote((prev) => ({ ...prev, [drawer.id]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Pill tone="danger"
                    disabled={busyId === drawer.id || (note[drawer.id] ?? '').trim().length < 10}
                    onClick={() => void review(drawer.id, 'reject')}>
                    Reject
                  </Pill>
                  <Pill
                    disabled={busyId === drawer.id || (drawer.review ? !drawer.review.canApprove : false)}
                    onClick={() => void review(drawer.id, 'approve')}>
                    {busyId === drawer.id ? 'Working…' : '✓ Approve'}
                  </Pill>
                </div>
                <p className="text-[10.5px] text-ink-muted">
                  Approving activates lending immediately. All required business and contact identity fields must be present.
                </p>
              </div>
            )}

            {/* full detail link */}
            <button
              onClick={() => { setDrawer(null); nav(`/admin/tenants/${drawer.id}`); }}
              className="mt-2 w-full rounded-[3px] border border-brand-600 py-2 text-[11.5px] font-bold text-brand-600 hover:bg-brand-50">
              Open full detail page →
            </button>
          </div>
        )}
      </Drawer>
    </div>
  );
}
