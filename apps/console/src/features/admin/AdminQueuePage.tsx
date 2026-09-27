import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiFileText } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  AppTable, BandCardSkeleton, Drawer, PageActionBar, Pill, Sk, TextAreaSkeleton,
  type Column, type FilterOption,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface TenantRow {
  id: string; name: string; type: string; status: string;
  verificationNote: string | null; bozSubmittedAt: string | null;
  bozFile: { id: string; mime: string; size: number } | null;
  ownerPhone: string | null; ownerName: string | null; createdAt: string;
}

interface PlatformTerms { version: number; body: string; publishedAt: string }

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

// ── Platform Terms editor ──────────────────────────────────────────────────

function PlatformTermsEditor() {
  const [current, setCurrent] = useState<PlatformTerms | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    api.get<PlatformTerms>('/admin/terms/platform')
      .then((r) => { setCurrent(r.data); setDraft(r.data.body); })
      .catch(() => setError('Could not load platform terms'))
      .finally(() => setLoading(false));
  }, []);

  async function publish() {
    setPublishing(true); setError(''); setFlash('');
    try {
      const res = await api.post<{ version: number }>('/admin/terms/platform', { body: draft });
      setFlash(`Platform Terms v${res.data.version} published — all users will be asked to re-accept.`);
      setCurrent((c) => c ? { ...c, version: res.data.version, body: draft, publishedAt: new Date().toISOString() } : null);
    } catch (e) { setError(apiError(e)); }
    finally { setPublishing(false); }
  }

  if (loading) {
    return (
      <BandCardSkeleton title="w-48" right>
        <div className="p-4">
          <Sk w="w-3/4" h="h-2" className="mb-2" />
          <TextAreaSkeleton height={300} />
          <div className="mt-3 flex items-center justify-between">
            <Sk w="w-32" h="h-2" />
            <Sk w="w-28" h="h-8" />
          </div>
        </div>
      </BandCardSkeleton>
    );
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <div className="band">
        <span className="t">{current ? `Platform Terms · v${current.version}` : 'Publish Platform Terms v1'}</span>
        {current && (
          <a href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'}/terms/platform/pdf`}
            target="_blank" rel="noopener noreferrer"
            className="ml-auto flex items-center gap-1 text-[10.5px] font-bold text-brand-600 hover:underline">
            <FiFileText size={11} /> Current PDF
          </a>
        )}
      </div>
      <div className="p-4">
        {error && <div className="mb-3"><ErrorBox message={error} /></div>}
        {flash && (
          <div className="mb-3 flex items-center gap-2 rounded-[3px] border border-emerald-200 bg-accent-50 px-3 py-2 text-[11.5px] font-semibold text-accent-700">
            <FiCheck size={12} /> {flash}
          </div>
        )}
        <p className="mb-2 text-[11px] text-ink-muted">
          Publishing a new version requires all registered businesses to re-accept before they can continue.
        </p>
        <textarea
          className={`${inputCls} min-h-[300px] font-mono text-[12px] leading-relaxed`}
          value={draft} onChange={(e) => setDraft(e.target.value)}
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10.5px] text-ink-muted">{draft.trim().length} chars · min 50</span>
          <Pill onClick={publish}
            disabled={publishing || draft.trim().length < 50 || draft.trim() === current?.body.trim()}>
            {publishing ? 'Publishing…' : current ? `Publish v${current.version + 1}` : 'Publish v1'}
          </Pill>
        </div>
      </div>
    </div>
  );
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
        <PlatformTermsEditor />
      ) : (
        <AppTable
          columns={columns}
          rows={rows}
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
                    disabled={busyId === drawer.id || !drawer.bozFile}
                    onClick={() => void review(drawer.id, 'approve')}>
                    {busyId === drawer.id ? 'Working…' : '✓ Approve'}
                  </Pill>
                </div>
                <p className="text-[10.5px] text-ink-muted">
                  Approving activates lending immediately. A certificate must be uploaded first.
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
