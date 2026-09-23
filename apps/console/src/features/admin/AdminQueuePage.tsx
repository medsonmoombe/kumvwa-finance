import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiFileText, FiShield } from 'react-icons/fi';

import {
  Avatar,
  Card,
  CenteredSpinner,
  Empty,
  ErrorBox,
  Spinner,
  StatusBadge,
  inputCls,
} from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { date } from '../../lib/format';

interface TenantRow {
  id: string;
  name: string;
  type: string;
  status: string;
  verificationNote: string | null;
  bozSubmittedAt: string | null;
  bozFile: {
    id: string;
    kind: string;
    mime: string;
    size: number;
    createdAt: string;
  } | null;
  ownerPhone: string | null;
  ownerName: string | null;
  createdAt: string;
}

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending_verification', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'rejected', label: 'Rejected' },
];

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminQueuePage() {
  const [rows, setRows] = useState<TenantRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [note, setNote] = useState<Record<string, string>>({});
  const [nrc, setNrc] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setError('');
    api
      .get<TenantRow[]>('/admin/tenants', {
        params: filter ? { status: filter } : {},
      })
      .then((r) => setRows(r.data))
      .catch(() => setError('Could not load the verification queue'));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function review(id: string, decision: 'approve' | 'reject') {
    if (busyId) return;
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/admin/tenants/${id}/verification`, {
        decision,
        ...(decision === 'reject' ? { reason: note[id] ?? '' } : {}),
      });
      load();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusyId('');
    }
  }

  async function viewCert(fileId: string) {
    setError('');
    try {
      const res = await api.get<{ downloadUrl: string }>(
        `/files/${fileId}/download-url`,
      );
      window.open(res.data.downloadUrl, '_blank', 'noopener');
    } catch (e) {
      setError(apiError(e));
    }
  }

  /**
   * NRC is PII — each reveal is a separate, audited request rather than being
   * bundled into the list response.
   */
  async function revealNrc(id: string) {
    setError('');
    try {
      const res = await api.get<{ ownerNrc: string | null }>(
        `/admin/tenants/${id}/identity`,
      );
      setNrc((prev) => ({ ...prev, [id]: res.data.ownerNrc ?? '—' }));
    } catch (e) {
      setError(apiError(e));
    }
  }

  if (!rows) return <CenteredSpinner />;

  const pending = rows.filter(
    (r) => r.status === 'pending_verification',
  ).length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <FiShield size={17} />
        </div>
        <div>
          <h1 className="font-display text-[18px] font-bold tracking-tight">
            Verification Queue
          </h1>
          <p className="text-[11.5px] text-ink-muted">
            {pending} awaiting review · {rows.length} shown
          </p>
        </div>
      </div>

      <div className="mt-4 flex rounded-[10px] border-[1.5px] border-line bg-white p-0.5" style={{ width: 'fit-content' }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
              filter === f.value
                ? 'bg-brand-600 text-white'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {rows.length === 0 && (
          <Card>
            <Empty icon={<FiShield />} title="Nothing in this view" />
          </Card>
        )}

        {rows.map((t) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-center gap-3">
              <Avatar name={t.name} size={36} />
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{t.name}</div>
                <div className="text-[11.5px] text-ink-muted">
                  {t.ownerName ?? 'no owner'} · {t.ownerPhone ?? '—'} · {t.type}{' '}
                  · submitted {t.bozSubmittedAt ? date(t.bozSubmittedAt) : '—'}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </div>

            {t.verificationNote && (
              <div className="mt-3 rounded-xl bg-warn-50 p-2.5 text-[12px] text-warn-500">
                <b>Note sent:</b> {t.verificationNote}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {t.bozFile ? (
                <button
                  type="button"
                  onClick={() => void viewCert(t.bozFile!.id)}
                  className="flex items-center gap-1.5 text-[12.5px] font-bold text-brand-600 underline"
                >
                  <FiFileText size={13} /> View certificate (
                  {formatBytes(t.bozFile.size)})
                </button>
              ) : (
                <span className="text-[12.5px] text-ink-muted">
                  No certificate uploaded
                </span>
              )}

              <button
                type="button"
                onClick={() => void revealNrc(t.id)}
                className="text-[12.5px] font-bold text-ink-2 underline"
              >
                Reveal owner NRC
              </button>

              {nrc[t.id] && (
                <span className="rounded-lg bg-surface px-2.5 py-1 font-mono text-[12px]">
                  {nrc[t.id]}
                </span>
              )}
            </div>

            {t.status === 'pending_verification' && (
              <div className="mt-3 space-y-2.5 border-t border-line pt-3">
                <input
                  className={`${inputCls} py-2.5 text-[12.5px]`}
                  placeholder="Rejection note (required to reject, min 10 chars)"
                  value={note[t.id] ?? ''}
                  onChange={(e) =>
                    setNote((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                />
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    disabled={
                      busyId === t.id || (note[t.id] ?? '').trim().length < 10
                    }
                    onClick={() => void review(t.id, 'reject')}
                    className="h-[42px] flex-1 rounded-btn border-[1.5px] border-danger-500/40 text-[13px] font-bold text-danger-500 disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyId === t.id || !t.bozFile}
                    onClick={() => void review(t.id, 'approve')}
                    className="flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-btn bg-accent-500 text-[13px] font-bold text-white disabled:opacity-40"
                  >
                    {busyId === t.id ? (
                      <Spinner className="border-white" />
                    ) : (
                      <>
                        <FiCheck size={14} /> Approve
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-ink-muted">
                  Approving activates lending immediately and notifies the owner.
                  A certificate must be uploaded first.
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
