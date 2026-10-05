import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheck, FiRotateCcw } from 'react-icons/fi';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  ConfirmDialog, ListSkeleton, PageActionBar, PageTabs, Pill, SearchInput,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { PlatformTermsEditor } from './PlatformTermsEditor';

type SettingType = 'boolean' | 'string' | 'text' | 'number' | 'select';
type SettingValue = boolean | string | number;

interface SettingItem {
  key: string;
  label: string;
  type: SettingType;
  group: string;
  help?: string;
  options?: readonly string[];
  min?: number;
  max?: number;
  default: SettingValue;
  value: SettingValue;
  isDefault: boolean;
  enforced: boolean;
}

interface SettingsResponse { items: SettingItem[]; groups: readonly string[] }

const TABS = [
  { id: 'settings', label: 'Platform Settings' },
  { id: 'terms', label: 'Platform Terms' },
];

/** Compares against the value the API reports, so 1 vs "1" is not a false edit. */
function isDirty(item: SettingItem, draft: SettingValue) {
  return String(draft) !== String(item.value);
}

export function AdminSettingsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'terms' ? 'terms' : 'settings';

  const [data, setData] = useState<SettingsResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, SettingValue>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [confirm, setConfirm] = useState<null | { kind: 'one' | 'all'; key?: string }>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get<SettingsResponse>('/admin/settings');
      setData(res.data);
      setDrafts(Object.fromEntries(res.data.items.map((i) => [i.key, i.value])));
    } catch (e) {
      setError(apiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const items = data?.items ?? [];
  const overrides = items.filter((i) => !i.isDefault).length;

  const groups = useMemo(() => {
    const order = data?.groups ?? [];
    const present = new Set(items.map((i) => i.group));
    // An unknown group still renders, so a new catalogue entry never goes missing.
    return [...order.filter((g) => present.has(g)), ...[...present].filter((g) => !order.includes(g))];
  }, [data, items]);

  const dirtyKeys = useMemo(
    () => items.filter((i) => i.key in drafts && isDirty(i, drafts[i.key]!)).map((i) => i.key),
    [items, drafts],
  );

  function setDraft(key: string, value: SettingValue) {
    setDrafts((d) => ({ ...d, [key]: value }));
    setFlash('');
  }

  async function save(key: string) {
    setBusy(key); setError(''); setFlash('');
    try {
      await api.put(`/admin/settings/${key}`, { key, value: drafts[key] });
      setFlash(`Saved ${key}. Takes effect within a few seconds.`);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(''); }
  }

  async function resetAll() {
    setBusy('all'); setError(''); setFlash('');
    try {
      await api.post('/admin/settings/restore');
      setFlash('All settings restored to their defaults.');
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(''); setConfirm(null); }
  }

  async function resetOne(key: string) {
    setBusy(key); setError(''); setFlash('');
    try {
      await api.delete(`/admin/settings/${key}`);
      setFlash(`${key} restored to its default.`);
      await load();
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(''); setConfirm(null); }
  }

  const needle = q.trim().toLowerCase();

  return (
    <>
      <PageActionBar
        title="Platform Settings"
        sub={
          overrides === 0
            ? 'Every setting is at its shipped default'
            : `${overrides} of ${items.length} overridden`
        }
        actions={
          <>
            {dirtyKeys.length > 0 && (
              <span className="text-[10.5px] font-semibold text-amber-700">
                {dirtyKeys.length} unsaved
              </span>
            )}
            <Pill
              tone="ghost"
              onClick={() => void load()}
              disabled={loading || busy !== ''}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </Pill>
            <Pill
              tone="ghost"
              onClick={() => setConfirm({ kind: 'all' })}
              disabled={overrides === 0 || busy !== ''}
            >
              <FiRotateCcw size={11} /> Restore defaults
            </Pill>
          </>
        }
      />

      <div className="mb-4">
        <PageTabs
          tabs={TABS}
          active={tab}
          onChange={(id) => setParams(id === 'settings' ? {} : { tab: id }, { replace: true })}
        />
      </div>

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}
      {flash && (
        <div className="mb-3 flex items-center gap-2 rounded-[3px] border border-emerald-200 bg-accent-50 px-3 py-2 text-[11.5px] font-semibold text-accent-700">
          <FiCheck size={12} /> {flash}
        </div>
      )}

      {tab === 'terms' ? (
        <PlatformTermsEditor />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-ink-muted">
              <FiAlertTriangle size={12} className="text-amber-500" />
              Settings marked “not enforced” are stored and audited, but no code reads them yet.
            </div>
            <SearchInput value={q} onChange={setQ} placeholder="Find a setting" />
          </div>

          {loading ? (
            <ListSkeleton rows={5} />
          ) : (
            <div className="overflow-hidden rounded-card border border-line bg-white">
              {groups.map((group, gi) => {
                const rows = items.filter((i) => i.group === group);
                const visible = needle
                  ? rows.filter((i) =>
                      `${i.key} ${i.label} ${i.help ?? ''}`.toLowerCase().includes(needle))
                  : rows;
                if (!visible.length) return null;

                return (
                  <section key={group} className={gi > 0 ? 'border-t border-line' : ''}>
                    <div className="band">
                      <span className="t">{group}</span>
                    </div>

                    {visible.map((item) => {
                      const draft = drafts[item.key] ?? item.value;
                      const dirty = isDirty(item, draft);

                      return (
                        <div
                          key={item.key}
                          className="flex flex-wrap items-start justify-between gap-3 border-t border-line px-3.5 py-3 first:border-t-0"
                        >
                          <div className="min-w-[220px] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12.5px] font-semibold">{item.label}</span>
                              <code className="rounded-[3px] bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-ink-muted">
                                {item.key}
                              </code>
                              {item.enforced ? (
                                <Badge color="green">Enforced</Badge>
                              ) : (
                                <Badge color="grey">Not enforced</Badge>
                              )}
                              {!item.isDefault && <Badge color="amber">Overridden</Badge>}
                            </div>
                            {item.help && (
                              <p className="mt-1 text-[11px] text-ink-muted">{item.help}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <SettingEditor
                              item={item}
                              value={draft}
                              onChange={(v) => setDraft(item.key, v)}
                            />
                            <Pill
                              onClick={() => void save(item.key)}
                              disabled={!dirty || busy !== ''}
                            >
                              {busy === item.key ? 'Saving…' : 'Save'}
                            </Pill>
                            {!item.isDefault && (
                              <Pill
                                tone="ghost"
                                onClick={() => setConfirm({ kind: 'one', key: item.key })}
                                disabled={busy !== ''}
                              >
                                Reset
                              </Pill>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </section>
                );
              })}

              {!items.length && (
                <p className="p-6 text-center text-[12px] text-ink-muted">
                  No settings available.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'all') void resetAll();
          else if (confirm?.key) void resetOne(confirm.key);
        }}
        busy={busy !== ''}
        danger
        title={confirm?.kind === 'all' ? 'Restore every setting?' : 'Restore this setting?'}
        body={
          confirm?.kind === 'all'
            ? 'All overrides are deleted and every setting goes back to its shipped default. Businesses stay signed in, but live behaviour changes immediately.'
            : `${confirm?.key} goes back to its default value.`
        }
        confirmLabel={confirm?.kind === 'all' ? 'Restore all' : 'Restore'}
      />
    </>
  );
}

/**
 * One editor per catalogue type. Anything unrecognised falls back to a read-only
 * string rather than silently writing a value the API would coerce.
 */
function SettingEditor({
  item, value, onChange,
}: {
  item: SettingItem;
  value: SettingValue;
  onChange: (v: SettingValue) => void;
}) {
  if (item.type === 'boolean') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={value === true}
        aria-label={item.label}
        onClick={() => onChange(!(value === true))}
        className={`relative h-6 w-11 rounded-full transition-colors ${value === true ? 'bg-brand-600' : 'bg-line'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value === true ? 'left-[22px]' : 'left-0.5'}`}
        />
      </button>
    );
  }

  if (item.type === 'select') {
    return (
      <select
        className={`${inputCls} w-44`}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        {(item.options ?? []).map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  if (item.type === 'number') {
    return (
      <input
        type="number"
        className={`${inputCls} w-40`}
        value={String(value)}
        min={item.min}
        max={item.max}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
    );
  }

  if (item.type === 'text') {
    return (
      <textarea
        className={`${inputCls} h-20 w-full max-w-[420px]`}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      className={`${inputCls} w-64`}
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}