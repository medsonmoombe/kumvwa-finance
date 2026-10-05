import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiFileText } from 'react-icons/fi';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import { BandCardSkeleton, ConfirmDialog, Pill, Sk, TextAreaSkeleton } from '../../components/kit';
import { api, apiError } from '../../lib/api';

export type LegalKind = 'terms' | 'privacy';

interface PlatformDocument {
  kind: LegalKind;
  title: string;
  version: number;
  body: string;
  publishedAt: string;
}

const DOCS: { kind: LegalKind; label: string; blurb: string }[] = [
  {
    kind: 'terms',
    label: 'Terms of Service',
    blurb:
      'The contract every client accepts. Publishing a new version makes each registered business and client re-accept before continuing.',
  },
  {
    kind: 'privacy',
    label: 'Privacy Policy',
    blurb:
      'How Kumvwa handles personal data under the Data Protection Act, 2021. Shown in the app and published for download; publishing does not add an acceptance gate.',
  },
];

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1';

/**
 * One editor for both legal documents.
 *
 * Publishing is versioned and never edits in place — acceptances point at the
 * exact version a user agreed to, so overwriting a body would make a recorded
 * acceptance meaningless. The publish button therefore stays disabled until the
 * text actually changed, and the confirm dialog states what a publish does.
 */
export function PlatformTermsEditor() {
  const [kind, setKind] = useState<LegalKind>('terms');
  const [current, setCurrent] = useState<PlatformDocument | null>(null);
  const [history, setHistory] = useState<{ version: number; publishedAt: string }[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback((which: LegalKind) => {
    setLoading(true);
    setError('');
    setFlash('');
    setShowHistory(false);
    api
      .get<PlatformDocument>(`/admin/terms/platform/${which}`)
      .then((r) => {
        setCurrent(r.data);
        setDraft(r.data.body);
      })
      .catch(() => setError(`Could not load the ${which === 'terms' ? 'terms' : 'privacy policy'}`))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(kind); }, [kind, load]);

  // Version history is only fetched when the admin asks for it.
  useEffect(() => {
    if (!showHistory) return;
    api
      .get<{ version: number; publishedAt: string }[]>(`/admin/terms/platform/${kind}/history`)
      .then((r) => setHistory(r.data))
      .catch(() => setError('Could not load version history'));
  }, [showHistory, kind]);

  const active = DOCS.find((d) => d.kind === kind)!;
  const unchanged = current != null && draft.trim() === current.body.trim();
  const tooShort = draft.trim().length < 50;

  async function publish() {
    setPublishing(true);
    setError('');
    try {
      const res = await api.post<{ version: number }>(`/admin/terms/platform/${kind}`, {
        body: draft,
      });
      setFlash(
        `${active.label} v${res.data.version} published. ${
          kind === 'terms'
            ? 'All users will be asked to re-accept.'
            : 'Users see the new policy immediately in the app.'
        }`,
      );
      setCurrent((c) =>
        c
          ? { ...c, version: res.data.version, body: draft, publishedAt: new Date().toISOString() }
          : null,
      );
      setHistory((h) => [{ version: res.data.version, publishedAt: new Date().toISOString() }, ...h]);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setPublishing(false);
      setConfirm(false);
    }
  }

  if (loading) {
    return (
      <BandCardSkeleton title="w-48" right>
        <div className="p-4">
          <Sk w="w-3/4" h="h-2.5" className="mb-2" />
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
    <>
      {/* Which document is being edited. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {DOCS.map((d) => {
          const selected = d.kind === kind;
          return (
            <button
              key={d.kind}
              type="button"
              onClick={() => setKind(d.kind)}
              aria-pressed={selected}
              className={
                selected
                  ? 'flex items-center gap-2 rounded-card border border-brand-600 bg-brand-50 px-3 py-2 text-[11.5px] font-bold text-brand-700'
                  : 'flex items-center gap-2 rounded-card border border-line bg-white px-3 py-2 text-[11.5px] font-semibold text-ink-2 hover:bg-[#FAFBFD]'
              }
            >
              {d.label}
              {selected && current && (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[9.5px] font-extrabold text-white">
                  v{current.version}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="band">
          <span className="t">
            {current ? `${active.label} · v${current.version}` : `Publish ${active.label} v1`}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {current && (
              <>
                <button
                  type="button"
                  onClick={() => setShowHistory((s) => !s)}
                  className="text-[10.5px] font-bold text-ink-muted hover:text-brand-600 hover:underline"
                >
                  {showHistory ? 'Hide history' : 'Version history'}
                </button>
                <a
                  href={`${apiBase}/terms/platform/${kind}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10.5px] font-bold text-brand-600 hover:underline"
                >
                  <FiFileText size={11} /> Current PDF
                </a>
              </>
            )}
          </div>
        </div>

        <div className="p-4">
          {error && <div className="mb-3"><ErrorBox message={error} /></div>}
          {flash && (
            <div className="mb-3 flex items-center gap-2 rounded-[3px] border border-emerald-200 bg-accent-50 px-3 py-2 text-[11.5px] font-semibold text-accent-700">
              <FiCheck size={12} /> {flash}
            </div>
          )}

          <p className="mb-3 text-[11px] leading-relaxed text-ink-muted">{active.blurb}</p>

          {showHistory && (
            <div className="mb-3 overflow-hidden rounded-[3px] border border-line">
              <div className="border-b border-line bg-[#FAFBFD] px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
                Published versions
              </div>
              {history.length === 0 ? (
                <p className="px-3 py-2.5 text-[11.5px] text-ink-muted">Loading…</p>
              ) : (
                history.map((h, i) => (
                  <div
                    key={h.version}
                    className={
                      i === 0
                        ? 'flex items-center justify-between border-b border-line px-3 py-2 text-[11.5px] last:border-b-0'
                        : 'flex items-center justify-between border-b border-line px-3 py-2 text-[11.5px] text-ink-2 last:border-b-0'
                    }
                  >
                    <span className="font-bold">v{h.version}</span>
                    <span className="text-[10.5px] text-ink-muted">
                      {new Date(h.publishedAt).toLocaleString()}
                    </span>
                    {i === 0 && <Badge color="green" dot>current</Badge>}
                  </div>
                ))
              )}
            </div>
          )}

          <textarea
            className={`${inputCls} min-h-[300px] font-mono text-[12px] leading-relaxed`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />

          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10.5px] text-ink-muted">
              {draft.trim().length} chars · min 50
              {unchanged && ' · unchanged'}
            </span>
            <Pill
              onClick={() => setConfirm(true)}
              disabled={publishing || tooShort || unchanged}
            >
              {publishing
                ? 'Publishing…'
                : current
                  ? `Publish v${current.version + 1}`
                  : 'Publish v1'}
            </Pill>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={publish}
        title={`Publish ${active.label} v${current ? current.version + 1 : 1}?`}
        body={
          kind === 'terms'
            ? 'Every registered business and client will be asked to accept the new version before they can continue. The previous version is kept for the records.'
            : 'The new policy becomes visible in the app immediately and the previous version is kept for the records.'
        }
        confirmLabel={publishing ? 'Publishing…' : `Publish v${current ? current.version + 1 : 1}`}
        busy={publishing}
      />
    </>
  );
}