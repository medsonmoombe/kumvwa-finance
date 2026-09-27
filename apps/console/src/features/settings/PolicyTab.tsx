import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

import { Badge, inputCls } from '../../components/ui';
import {
  ConfirmDialog, Field, FormGrid, FormSection, FormSkeleton, Pill, Sk,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';

export interface CreditTier {
  clearedFrom: number; label: string; limitKwacha: number; maxTermMonths: number;
}
export interface CreditRules {
  maxActiveLoans: number; blockIfOverdue: boolean; cooldownDaysAfterDefault: number;
}
export interface CreditPolicy { tiers: CreditTier[]; rules: CreditRules }

const DEFAULT_POLICY: CreditPolicy = {
  tiers: [
    { clearedFrom: 0, label: 'First-time borrower', limitKwacha: 1000, maxTermMonths: 1 },
    { clearedFrom: 1, label: 'Building trust', limitKwacha: 2500, maxTermMonths: 2 },
    { clearedFrom: 2, label: 'Proven borrower', limitKwacha: 5000, maxTermMonths: 3 },
    { clearedFrom: 4, label: 'Trusted client', limitKwacha: 10000, maxTermMonths: 6 },
    { clearedFrom: 7, label: 'VIP', limitKwacha: 20000, maxTermMonths: 12 },
  ],
  rules: { maxActiveLoans: 1, blockIfOverdue: true, cooldownDaysAfterDefault: 90 },
};

export function PolicyTab({
  onFlash, onError,
}: {
  onFlash: (m: string) => void; onError?: (m: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const [policy, setPolicy] = useState<CreditPolicy>(DEFAULT_POLICY);
  const [publishing, setPublishing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(() => {
    api.get<{ policy: CreditPolicy; version: number }>('/tenants/me/credit-policy')
      .then((r) => { setPolicy(r.data.policy); setVersion(r.data.version); })
      .catch((e) => onError?.(apiError(e)))
      .finally(() => setLoaded(true));
  }, [onError]);

  useEffect(() => { load(); }, [load]);

  const publishable = useMemo(() =>
    policy.tiers.length > 0 &&
    policy.tiers.every((t) => t.label.trim().length > 0 && t.clearedFrom >= 0 && t.limitKwacha > 0 && t.maxTermMonths >= 1),
    [policy]);

  function setTier(i: number, patch: Partial<CreditTier>) {
    setPolicy((p) => ({ ...p, tiers: p.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) }));
  }

  function addTier() {
    const last = policy.tiers[policy.tiers.length - 1];
    setPolicy((p) => ({
      ...p,
      tiers: [...p.tiers, {
        clearedFrom: (last?.clearedFrom ?? 0) + 1,
        label: '', limitKwacha: last?.limitKwacha ?? 1000, maxTermMonths: last?.maxTermMonths ?? 1,
      }],
    }));
  }

  function removeTier(i: number) {
    setPolicy((p) => ({ ...p, tiers: p.tiers.filter((_, j) => j !== i) }));
  }

  async function publish() {
    setPublishing(true); onError?.('');
    try {
      const res = await api.put<{ version: number }>('/tenants/me/credit-policy', policy);
      setVersion(res.data.version);
      onFlash(`Credit policy v${res.data.version} published — applies to new requests immediately`);
    } catch (e) { onError?.(apiError(e)); }
    finally { setPublishing(false); setConfirm(false); }
  }

  if (!loaded) {
    return (
      <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
        <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
          <Sk w="w-28" h="h-2.5" />
          <Sk w="w-24" h="h-4" className="rounded-full" />
        </div>
        <div className="p-3.5">
          <FormSection title="Credit Ladder" defaultOpen>
            <FormSkeleton fields={12} cols={4} />
          </FormSection>
          <FormSection title="Application Rules" defaultOpen>
            <FormSkeleton fields={3} />
          </FormSection>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
            Lending Policy
          </span>
          {version > 0
            ? <Badge color="green" dot>Version {version}</Badge>
            : <Badge color="amber" dot>Platform default (not yet published)</Badge>}
        </div>

        <FormSection title="Credit Ladder" defaultOpen>
          <p className="mb-3 text-[11.5px] text-ink-muted">
            Clients climb by clearing loans with your business. The top tier is the ceiling any manual override can grant.
          </p>
          <FormGrid cols={4}>
            {['Repaid ≥', 'Tier name', 'Limit (K)', 'Max term'].map((h) => (
              <div key={h} className="text-[10px] font-bold uppercase text-ink-muted">{h}</div>
            ))}
            {policy.tiers.map((t, i) => (
              <Fragment key={i}>
                <input className={inputCls} inputMode="numeric" value={t.clearedFrom}
                  onChange={(e) => setTier(i, { clearedFrom: Number(e.target.value) || 0 })} />
                <input className={inputCls} value={t.label} placeholder="Tier label"
                  onChange={(e) => setTier(i, { label: e.target.value })} />
                <input className={inputCls} inputMode="numeric" value={t.limitKwacha}
                  onChange={(e) => setTier(i, { limitKwacha: Number(e.target.value) || 0 })} />
                <div className="flex items-center gap-1.5">
                  <input className={inputCls} inputMode="numeric" value={t.maxTermMonths}
                    onChange={(e) => setTier(i, { maxTermMonths: Number(e.target.value) || 1 })} />
                  <button type="button" onClick={() => removeTier(i)}
                    disabled={policy.tiers.length === 1}
                    className="rounded-[3px] p-1 text-red-500 hover:bg-red-50 disabled:opacity-30">
                    <FiTrash2 size={13} />
                  </button>
                </div>
              </Fragment>
            ))}
          </FormGrid>
          <button type="button" onClick={addTier}
            className="mt-3 flex items-center gap-1.5 text-[11.5px] font-bold text-brand-600 hover:text-brand-900">
            <FiPlus size={12} /> Add tier
          </button>
        </FormSection>

        <FormSection title="Application Rules" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Max active loans per client">
              <input className={inputCls} inputMode="numeric" value={policy.rules.maxActiveLoans}
                onChange={(e) => setPolicy({ ...policy, rules: { ...policy.rules, maxActiveLoans: Number(e.target.value) || 1 } })} />
            </Field>
            <Field label="Cooldown after default (days)">
              <input className={inputCls} inputMode="numeric" value={policy.rules.cooldownDaysAfterDefault}
                onChange={(e) => setPolicy({ ...policy, rules: { ...policy.rules, cooldownDaysAfterDefault: Number(e.target.value) || 0 } })} />
            </Field>
            <Field label="Block applications when overdue">
              <button type="button"
                onClick={() => setPolicy({ ...policy, rules: { ...policy.rules, blockIfOverdue: !policy.rules.blockIfOverdue } })}
                className={`h-[38px] w-full rounded-[3px] border text-[12px] font-bold transition-colors ${
                  policy.rules.blockIfOverdue
                    ? 'border-accent-200 bg-accent-50 text-accent-700'
                    : 'border-line bg-white text-ink-muted hover:bg-surface'
                }`}>
                {policy.rules.blockIfOverdue ? 'Blocking' : 'Allowing'}
              </button>
            </Field>
          </FormGrid>
        </FormSection>

        <div className="flex items-center justify-between border-t border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10.5px] text-ink-muted">Applies to new requests immediately</span>
          <Pill onClick={() => setConfirm(true)} disabled={publishing || !publishable}>
            {version > 0 ? `Publish v${version + 1}` : 'Publish v1'}
          </Pill>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={publish}
        title="Publish credit policy?"
        body={`This will become v${version + 1} and apply to all new loan requests immediately. Existing loans are not affected.`}
        confirmLabel={publishing ? 'Publishing…' : `Publish v${version + 1}`}
        busy={publishing}
      />
    </>
  );
}
