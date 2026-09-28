import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Badge, ErrorBox, inputCls } from '../../components/ui';
import {
  BandCardSkeleton, DataGrid, Field, FormGrid, FormSkeleton, FormSection,
  PageActionBar, PageHeadSkeleton, PageTabs, Pill, Sk, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';

interface ProductState {
  code: string; name: string; description: string;
  rateBps: number; minAmount: number; maxAmount: number;
  minTerm: number; maxTerm: number; frequency: string;
  repaymentStructure: string; originationFeeBps: number;
  feeTreatment: string; penaltyBpsPerDay: number; penaltyCapBps: number;
  active: boolean;
}

const EMPTY: ProductState = {
  code: '', name: '', description: '', rateBps: 1500,
  minAmount: 100, maxAmount: 5000, minTerm: 1, maxTerm: 3,
  frequency: 'monthly', repaymentStructure: 'bullet',
  originationFeeBps: 0, feeTreatment: 'add',
  penaltyBpsPerDay: 0, penaltyCapBps: 2000, active: true,
};

function preview(p: ProductState) {
  const principal = 1000;
  const interest = Math.round(principal * p.rateBps) / 10000;
  const fee = Math.round(principal * p.originationFeeBps) / 10000;
  const total = principal + interest + fee;
  const per = p.repaymentStructure === 'bullet' ? total : total / Math.max(1, p.minTerm);
  return { principal, interest, fee, total, per };
}

const pct = (bps: number) => (bps / 100).toFixed(bps % 100 === 0 ? 0 : 1);
const fmtK = (n: number) => `K ${n.toLocaleString('en-ZM', { maximumFractionDigits: 2 })}`;

interface LedgerRow { id: string; code: string; gl: string; type: string }
const LEDGER_MAP: LedgerRow[] = [
  { id: '1', code: 'Loan registration account', gl: '030', type: 'No correction base value' },
  { id: '2', code: 'Interest receivable account', gl: '030', type: 'No correction base value' },
  { id: '3', code: 'Repayment holding account', gl: '35303', type: 'Based on sector code' },
  { id: '4', code: 'Due payment settlement account', gl: '35303', type: 'Based on sector code' },
  { id: '5', code: 'Fees receivable account', gl: '35513', type: 'Based on sector code' },
  { id: '6', code: 'Penalty receivable account', gl: '379117', type: 'No correction base value' },
];
const LEDGER_COLS: Array<Column<LedgerRow>> = [
  { key: 'code', header: 'Ledger Code Reference', render: (r) => r.code },
  { key: 'gl', header: 'GL Code', render: (r) => <span className="tabular-nums">{r.gl}</span> },
  { key: 'type', header: 'Correction Type', render: (r) => r.type },
  { key: 'assoc', header: 'Status', render: () => <Badge color="green" dot>Associated</Badge> },
];

// ── Shared form component ─────────────────────────────────────────────────────

export function ProductForm({
  id, onSaved, onCancel,
}: {
  id?: string; onSaved: () => void; onCancel: () => void;
}) {
  const isEdit = !!id;
  const [p, setP] = useState<ProductState | null>(isEdit ? null : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('ledger');

  useEffect(() => {
    if (!isEdit) return;
    api.get<Record<string, unknown>>(`/loan-products/${id}`)
      .then((r) => {
        const d = r.data;
        setP({
          code: (d.code as string | null) ?? '',
          name: d.name as string,
          description: (d.description as string | null) ?? '',
          rateBps: d.rateBps as number,
          minAmount: Number(d.minAmount),
          maxAmount: Number(d.maxAmount),
          minTerm: d.minTerm as number,
          maxTerm: d.maxTerm as number,
          frequency: d.frequency as string,
          repaymentStructure: d.repaymentStructure as string,
          originationFeeBps: d.originationFeeBps as number,
          feeTreatment: d.feeTreatment as string,
          penaltyBpsPerDay: d.penaltyBpsPerDay as number,
          penaltyCapBps: d.penaltyCapBps as number,
          active: d.active as boolean,
        });
      })
      .catch(() => setError('Could not load product'));
  }, [id, isEdit]);

  if (!p) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeadSkeleton />
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_300px]">
          <BandCardSkeleton title="w-40" right>
            <div className="space-y-4 p-3.5">
              <FormSkeleton fields={6} />
              <FormSkeleton fields={3} />
              <FormSkeleton fields={3} />
            </div>
          </BandCardSkeleton>
          <div className="space-y-3">
            <Sk w="w-40" h="h-2.5" />
            <div className="rounded-card border border-line bg-white p-4 shadow-c1">
              <div className="h-24 animate-pulse rounded-[2px] bg-[#E9ECF1]" />
              <div className="mt-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between border-b border-line-2 pb-2">
                    <Sk w="w-24" h="h-2.5" />
                    <Sk w="w-16" h="h-2.5" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const set = (patch: Partial<ProductState>) => setP({ ...p, ...patch });
  const pv = preview(p);

  async function save() {
    if (!p) return;
    setSaving(true); setError('');
    try {
      const payload = {
        name: p.name, code: p.code || undefined,
        description: p.description || undefined,
        rateBps: p.rateBps, minAmount: p.minAmount, maxAmount: p.maxAmount,
        minTerm: p.minTerm, maxTerm: p.maxTerm, frequency: p.frequency,
        repaymentStructure: p.repaymentStructure,
        originationFeeBps: p.originationFeeBps, feeTreatment: p.feeTreatment,
        penaltyBpsPerDay: p.penaltyBpsPerDay, penaltyCapBps: p.penaltyCapBps,
        active: p.active,
      };
      if (isEdit) await api.patch(`/loan-products/${id}`, payload);
      else await api.post('/loan-products', payload);
      onSaved();
    } catch (e) {
      setError(apiError(e));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorBox message={error} />}

      {/* active toggle */}
      {isEdit && (
        <div className="flex items-center justify-between rounded-[3px] border border-line bg-surface px-3 py-2">
          <span className="text-[11.5px] font-semibold text-ink-2">Product status</span>
          <button
            onClick={() => set({ active: !p.active })}
            className={`rounded-[3px] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide transition-colors ${
              p.active
                ? 'bg-accent-50 text-accent-700 border border-accent-200'
                : 'bg-gray-100 text-ink-muted border border-line'
            }`}
          >
            {p.active ? '● Active' : '● Inactive'}
          </button>
        </div>
      )}

      {/* config document */}
      <div className="overflow-hidden rounded-[3px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-[#FAFBFD] px-3 py-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted">
            {isEdit ? 'Modify' : 'Create'} · Loan Type
          </span>
          <span className="text-[10px] text-ink-muted">
            Currency: <b className="text-ink">ZMW</b>
          </span>
        </div>

        <FormSection title="Loan Type Data" defaultOpen>
          <FormGrid>
            <Field label="Code" required>
              <input className={inputCls} value={p.code}
                onChange={(e) => set({ code: e.target.value })} placeholder="e.g. PL-001" />
            </Field>
            <Field label="Name" required>
              <input className={inputCls} value={p.name}
                onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Personal Loan" />
            </Field>
            <Field label="Structure">
              <select className={inputCls} value={p.repaymentStructure}
                onChange={(e) => set({ repaymentStructure: e.target.value })}>
                <option value="bullet">Bullet (chunks by deadline)</option>
                <option value="installments">Installments (fixed schedule)</option>
              </select>
            </Field>
            <Field label="Description" span={3}>
              <input className={inputCls} value={p.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="Internal note — clients never see this" />
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Limits" defaultOpen>
          <FormGrid>
            <Field label="Min amount (K)" required>
              <input className={inputCls} inputMode="numeric" value={p.minAmount}
                onChange={(e) => set({ minAmount: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="Max amount (K)" required>
              <input className={inputCls} inputMode="numeric" value={p.maxAmount}
                onChange={(e) => set({ maxAmount: Number(e.target.value) || 0 })} />
            </Field>
            <div />
            <Field label="Min term (months)" required>
              <input className={inputCls} inputMode="numeric" value={p.minTerm}
                onChange={(e) => set({ minTerm: Number(e.target.value) || 1 })} />
            </Field>
            <Field label="Max term (months)" required>
              <input className={inputCls} inputMode="numeric" value={p.maxTerm}
                onChange={(e) => set({ maxTerm: Number(e.target.value) || 1 })} />
            </Field>
            <div />
          </FormGrid>
        </FormSection>

        <FormSection title="Interest and Fees" defaultOpen>
          <FormGrid>
            <Field label="Interest rate % (flat)" required>
              <input className={inputCls} inputMode="decimal" value={pct(p.rateBps)}
                onChange={(e) => set({ rateBps: Math.round((Number(e.target.value) || 0) * 100) })} />
            </Field>
            <Field label="Origination fee %">
              <input className={inputCls} inputMode="decimal" value={pct(p.originationFeeBps)}
                onChange={(e) => set({ originationFeeBps: Math.round((Number(e.target.value) || 0) * 100) })} />
            </Field>
            <Field label="Fee treatment">
              <select className={inputCls} value={p.feeTreatment}
                onChange={(e) => set({ feeTreatment: e.target.value })}>
                <option value="add">Added to total due</option>
                <option value="deduct">Deducted from disbursement</option>
              </select>
            </Field>
            <Field label="Repayment frequency">
              <select className={inputCls} value={p.frequency}
                onChange={(e) => set({ frequency: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
              </select>
            </Field>
            <Field label="Penalty % per day (0 = off)">
              <input className={inputCls} inputMode="decimal" value={pct(p.penaltyBpsPerDay)}
                onChange={(e) => set({ penaltyBpsPerDay: Math.round((Number(e.target.value) || 0) * 100) })} />
            </Field>
            <Field label="Penalty cap %">
              <input className={inputCls} inputMode="decimal" value={pct(p.penaltyCapBps)}
                onChange={(e) => set({ penaltyCapBps: Math.round((Number(e.target.value) || 0) * 100) })} />
            </Field>
          </FormGrid>
        </FormSection>
      </div>

      {/* live preview */}
      <div className="overflow-hidden rounded-[3px] border border-line bg-white">
        <div className="band"><span className="t">Live preview · K 1,000 example</span></div>
        <div className="p-3.5">
          <div className="rounded-[3px] bg-gradient-to-br from-brand-600 to-brand-900 p-3.5 text-white">
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#AFC3EE]">
              {p.repaymentStructure === 'bullet'
                ? `Due in full by month ${p.maxTerm}`
                : `${p.minTerm} monthly installments`}
            </div>
            <div className="mt-1 font-display text-[22px] font-extrabold">{fmtK(pv.total)}</div>
            <div className="text-[10px] text-[#C6D4F2]">total repayable on {fmtK(pv.principal)}</div>
          </div>
          <div className="mt-2.5 text-[11.5px]">
            {[
              ['Principal', fmtK(pv.principal)],
              [`Interest (${pct(p.rateBps)}%)`, fmtK(pv.interest)],
              [`Fee (${pct(p.originationFeeBps)}% ${p.feeTreatment})`, fmtK(pv.fee)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line-2 py-1.5">
                <span className="text-ink-muted">{k}</span>
                <b className="tabular-nums">{v}</b>
              </div>
            ))}
            <div className="flex justify-between pt-2">
              <span className="font-bold text-ink">Per {p.repaymentStructure === 'bullet' ? 'deadline' : 'month'}</span>
              <b className="font-display tabular-nums text-brand-600">{fmtK(pv.per)}</b>
            </div>
          </div>
          {p.penaltyBpsPerDay > 0 && (
            <div className="mt-2 rounded-[3px] bg-amber-50 p-2 text-[10.5px] text-amber-700">
              Late payments accrue {pct(p.penaltyBpsPerDay)}%/day, capped at {pct(p.penaltyCapBps)}%.
            </div>
          )}
        </div>
      </div>

      {/* ledger reference */}
      <div className="overflow-hidden rounded-[3px] border border-line bg-white">
        <PageTabs
          tabs={[{ id: 'ledger', label: 'Ledger Codes' }, { id: 'fields', label: 'Field Descriptors' }]}
          active={tab} onChange={setTab}
        />
        {tab === 'ledger' ? (
          <DataGrid columns={LEDGER_COLS} rows={LEDGER_MAP} />
        ) : (
          <div className="px-4 py-8 text-center text-[12px] text-ink-muted">
            Field descriptors arrive with the accounting module — this product is already ledger-ready.
          </div>
        )}
      </div>

      {/* footer actions */}
      <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
        <Pill tone="ghost" onClick={onCancel}>Cancel</Pill>
        <Pill onClick={save} disabled={saving || !p.name.trim()}>
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Product'}
        </Pill>
      </div>
    </div>
  );
}

// ── Standalone page (direct URL /products/new or /products/:id) ───────────────

export function ProductFormPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const isEdit = id != null && id !== 'new';

  return (
    <div>
      <PageActionBar
        title={isEdit ? 'Edit Product' : 'Create Loan Product'}
        sub={isEdit ? undefined : 'New product — enforces on every application once saved'}
        actions={<Pill tone="ghost" onClick={() => nav('/products')}>← Back to products</Pill>}
      />
      <ProductForm
        id={isEdit ? id : undefined}
        onSaved={() => nav('/products')}
        onCancel={() => nav('/products')}
      />
    </div>
  );
}
