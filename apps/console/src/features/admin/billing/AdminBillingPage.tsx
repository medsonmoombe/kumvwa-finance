import { useCallback, useEffect, useState } from 'react';

import {
  DataGrid,
  Drawer,
  Field,
  FormGrid,
  KitButton,
  PageActionBar,
  PageTabs,
  Pill,
  SearchInput,
  StatBand,
  rowMatches,
  type Column,
} from '../../../components/kit';
import { Badge, Empty, ErrorBox, inputCls } from '../../../components/ui';
import { api, apiError } from '../../../lib/api';
import { date, money } from '../../../lib/format';

type Tab = 'overview' | 'plans' | 'lenders' | 'transactions';

// Search keys per grid — kept next to the tab definitions so adding a column
// to a table is a one-line change here too.
const PLAN_KEYS = ['name', 'key', 'interval'];
const LENDER_KEYS = ['tenantName', 'planName', 'planKey', 'status', 'promoNote'];
const TX_KEYS = ['reference', 'purpose', 'status', 'provider'];

interface Overview {
  lenders: number;
  subscriptions: number;
  byStatus: Record<string, number>;
  activeSlots: number;
  mrrMinor: string;
  mrr: string;
  recentPurchases: Array<{
    id: string;
    tenantId: string;
    count: number;
    amountMinor: string;
    amount: string;
    status: string;
    createdAt: string;
    periodEnd: string;
  }>;
}

interface Plan {
  id: string;
  key: string;
  name: string;
  includedClients: number;
  pricePerExtraClientMinor: string;
  pricePerExtraClient: string;
  interval: string;
  active: boolean;
  isDefault: boolean;
}

interface Lender {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  subscriptionId: string | null;
  planKey: string;
  planName: string;
  status: string;
  includedClientsOverride: number | null;
  priceOverrideMinor: string | null;
  promoNote: string | null;
  extraSlots: number;
  slotsExpireAt: string | null;
  used: number;
  capacity: number;
  remaining: number;
  atLimit: boolean;
}

interface Tx {
  id: string;
  reference: string;
  purpose: string;
  status: string;
  amountMinor: string;
  amount: string;
  provider: string;
  method: string;
  tenantId: string | null;
  createdAt: string;
}

/**
 * Platform-admin control of the money side: plans/pricing, per-lender plan
 * assignment and promotions, plus the cross-tenant transaction ledger. Every
 * write goes through the API — the console never trusts its own maths.
 */
export function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [lenders, setLenders] = useState<Lender[] | null>(null);
  const [txs, setTxs] = useState<Tx[] | null>(null);
  const [q, setQ] = useState('');

  // Per-lender drawer (plan / promotion / suspension).
  const [editing, setEditing] = useState<Lender | null>(null);
  const [form, setForm] = useState({
    planKey: '',
    status: 'active',
    includedClientsOverride: '',
    priceOverrideMinor: '',
    promoNote: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);

  const say = (msg: string) => {
    setFlash(msg);
    setError('');
    window.setTimeout(() => setFlash(''), 4000);
  };

  const loadOverview = useCallback(() => {
    api
      .get<Overview>('/admin/billing/overview')
      .then((r) => setOverview(r.data))
      .catch((e: any) => setError(apiError(e)));
  }, []);

  const loadPlans = useCallback(() => {
    api
      .get<{ items: Plan[] }>('/admin/billing/plans')
      .then((r) => setPlans(r.data.items))
      .catch((e: any) => setError(apiError(e)));
  }, []);

  const loadLenders = useCallback(() => {
    api
      .get<{ items: Lender[] }>('/admin/billing/subscriptions')
      .then((r) => setLenders(r.data.items))
      .catch((e: any) => setError(apiError(e)));
  }, []);

  const loadTxs = useCallback(() => {
    api
      .get<{ items: Tx[] }>('/admin/payments/transactions')
      .then((r) => setTxs(r.data.items))
      .catch((e: any) => setError(apiError(e)));
  }, []);

  useEffect(() => {
    if (tab === 'overview') loadOverview();
    if (tab === 'plans') loadPlans();
    if (tab === 'lenders') loadLenders();
    if (tab === 'transactions') loadTxs();
  }, [tab, loadOverview, loadPlans, loadLenders, loadTxs]);

  // ── plan inline edit ──
  async function savePlan(plan: Plan) {
    setError('');
    try {
      const included = Number(
        (document.getElementById(`inc-${plan.id}`) as HTMLInputElement).value,
      );
      const priceKw = Number(
        (document.getElementById(`price-${plan.id}`) as HTMLInputElement).value,
      );
      await api.patch(`/admin/billing/plans/${plan.id}`, {
        includedClients: included,
        pricePerExtraClientMinor: Math.round(priceKw * 100),
      });
      say(`Plan “${plan.name}” updated`);
      loadPlans();
    } catch (e) {
      setError(apiError(e));
    }
  }

  // ── per-lender save ──
  function openEditor(l: Lender) {
    setEditing(l);
    setForm({
      planKey: l.planKey,
      status: l.status,
      includedClientsOverride:
        l.includedClientsOverride === null ? '' : String(l.includedClientsOverride),
      priceOverrideMinor:
        l.priceOverrideMinor === null ? '' : String(Number(l.priceOverrideMinor) / 100),
      promoNote: l.promoNote ?? '',
      note: '',
    });
  }

  async function saveLender() {
    if (!editing) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/admin/billing/subscriptions/${editing.tenantId}`, {
        planKey: form.planKey,
        status: form.status,
        includedClientsOverride:
          form.includedClientsOverride === '' ? null : Number(form.includedClientsOverride),
        priceOverrideMinor:
          form.priceOverrideMinor === '' ? null : Math.round(Number(form.priceOverrideMinor) * 100),
        promoNote: form.promoNote || null,
        note: form.note || undefined,
      });
      say(`Billing updated for ${editing.tenantName}`);
      setEditing(null);
      loadLenders();
      loadOverview();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setSaving(false);
    }
  }

  const usageTone = (l: Lender): 'red' | 'blue' | 'green' =>
    l.atLimit ? 'red' : l.remaining <= 1 ? 'blue' : 'green';

  const lenderColumns: Array<Column<Lender>> = [
    {
      key: 'n',
      header: 'Lender',
      width: '30%',
      render: (l: Lender) => (
        <div>
          <b className="block font-semibold">{l.tenantName}</b>
          <span className="text-[10.5px] text-ink-muted">
            {l.planName} · {l.status}
            {l.promoNote ? ` · ${l.promoNote}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'u',
      header: 'Clients (used / free+paid)',
      width: '34%',
      render: (l: Lender) => (
        <div className="pr-5">
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="tabular-nums">
              {l.used} / {l.capacity}
            </span>
            <Badge color={usageTone(l)}>{l.remaining} left</Badge>
          </div>
          <div className="h-1.5 w-full rounded bg-[#E7EAF1]">
            <div
              className={`h-1.5 rounded ${l.atLimit ? 'bg-danger-500' : 'bg-[#2E63E6]'}`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round((l.used / Math.max(l.capacity, 1)) * 100),
                )}%`,
              }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'slots',
      header: 'Paid slots',
      render: (l: Lender) => (
        <div>
          <b className="tabular-nums">{l.extraSlots}</b>
          {l.slotsExpireAt && (
            <span className="block text-[10px] text-ink-muted">
              until {date(l.slotsExpireAt)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'act',
      header: '',
      render: (l: Lender) => (
        <Pill onClick={() => openEditor(l)}>Customise</Pill>
      ),
    },
  ];

  const txColumns: Array<Column<Tx>> = [
    {
      key: 'r',
      header: 'Reference',
      width: '30%',
      render: (t: Tx) => (
        <div>
          <b className="block text-[11.5px] tabular-nums">{t.reference}</b>
          <span className="text-[10px] text-ink-muted">
            {t.purpose.replaceAll('_', ' ')}
          </span>
        </div>
      ),
    },
    {
      key: 'a',
      header: 'Amount',
      render: (t: Tx) => <span className="tabular-nums">{money(t.amountMinor)}</span>,
    },
    {
      key: 'p',
      header: 'Provider',
      render: (t: Tx) => (
        <span className="capitalize">{t.provider.replaceAll('_', ' ')}</span>
      ),
    },
    {
      key: 's',
      header: 'Status',
      render: (t: Tx) => (
        <Badge
          color={
            t.status === 'succeeded'
              ? 'green'
              : t.status === 'failed'
                ? 'red'
                : 'blue'
          }
        >
          {t.status.replaceAll('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'd',
      header: 'Date',
      render: (t: Tx) => <span className="text-ink-muted">{date(t.createdAt)}</span>,
    },
  ];

  const planColumns: Array<Column<Plan>> = [
    {
      key: 'p',
      header: 'Plan',
      width: '34%',
      render: (p: Plan) => (
        <div>
          <b className="block font-semibold">
            {p.name}
            {p.isDefault ? '' : ''}
          </b>
          <span className="text-[10.5px] text-ink-muted">
            {p.key} · {p.interval}
            {p.isDefault ? ' · platform default' : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'inc',
      header: 'Free clients',
      render: (p: Plan) => (
        <input
          id={`inc-${p.id}`}
          type="number"
          min={0}
          defaultValue={p.includedClients}
          className={`${inputCls} w-24 py-1`}
        />
      ),
    },
    {
      key: 'price',
      header: 'K / extra client / month',
      render: (p: Plan) => (
        <input
          id={`price-${p.id}`}
          type="number"
          min={0}
          defaultValue={Number(p.pricePerExtraClientMinor) / 100}
          className={`${inputCls} w-28 py-1`}
        />
      ),
    },
    {
      key: 'act',
      header: '',
      render: (p: Plan) => <Pill onClick={() => void savePlan(p)}>Save</Pill>,
    },
  ];

  return (
    <div>
      <PageActionBar
        title="Billing"
        sub="Client-slot plans, per-lender customisation, and the payment ledger"
      />

      {flash && (
        <div className="mb-4 rounded-card border border-emerald-200 bg-accent-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-accent-700">
          {flash}
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      )}

      <PageTabs
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'plans', label: 'Plans & pricing' },
          { id: 'lenders', label: 'Lender subscriptions' },
          { id: 'transactions', label: 'Transactions' },
        ]}
        active={tab}
        onChange={(t: string) => setTab(t as Tab)}
      />

      {/* ── overview ── */}
      {tab === 'overview' &&
        (overview ? (
          <div>
            <StatBand
              cols={4}
              items={[
                { label: 'Lenders', value: String(overview.lenders) },
                { label: 'Subscriptions', value: String(overview.subscriptions) },
                { label: 'Active paid slots', value: String(overview.activeSlots) },
                { label: 'MRR from slots', value: money(overview.mrrMinor) },
              ]}
            />
            <div className="mt-2 overflow-hidden rounded-card border border-line bg-white">
              <div className="band">
                <span className="t">Recent slot purchases</span>
              </div>
              <div className="p-4">
                {overview.recentPurchases.length === 0 ? (
                  <p className="py-6 text-center text-[12px] text-ink-muted">
                    No client slots bought yet.
                  </p>
                ) : (
                  overview.recentPurchases.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between border-b border-line-2 py-2 text-[12px] last:border-0"
                    >
                      <div>
                        <b className="block text-[11.5px]">
                          {p.count} slot{p.count === 1 ? '' : 's'}
                        </b>
                        <span className="text-[10.5px] text-ink-muted">
                          {p.tenantId} · expires {date(p.periodEnd)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge color={p.status === 'active' ? 'green' : 'grey'}>
                          {p.status}
                        </Badge>
                        <b className="tabular-nums">{money(p.amountMinor)}</b>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="py-8 text-center text-[12px] text-ink-muted">Loading…</p>
        ))}

      {/* ── plans ── */}
      {tab === 'plans' && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="band">
            <span className="t">Plans & pricing</span>
            <span className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search plans" /></span>
          </div>
          <div className="p-4">
            <p className="mb-3 text-[11.5px] text-ink-muted">
              The free floor is how many clients a lender gets before extra slots
              are needed. The slot price is what a lender pays per additional
              client, per month (K100 default).
            </p>
            <DataGrid
              columns={planColumns}
              rows={plans?.filter((p) => rowMatches(p, PLAN_KEYS, q)) ?? null}
              empty={q.trim() ? 'No plans match your search' : 'No plans configured'}
            />
          </div>
        </div>
      )}

      {/* ── lenders: the per-tenant control surface ── */}
      {tab === 'lenders' && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="band">
            <span className="t">Lender subscriptions</span>
            <span className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search lenders" /></span>
          </div>
          <div className="p-4">
            <p className="mb-3 text-[11.5px] text-ink-muted">
              Assign a plan, override the free floor or the slot price for a
              promotion, or move a lender into grace/suspension. Changes take
              effect the moment they save.
            </p>
            <DataGrid
              columns={lenderColumns}
              rows={lenders?.filter((l) => rowMatches(l, LENDER_KEYS, q)) ?? null}
              empty={q.trim() ? 'No lenders match your search' : 'No lenders yet'}
              onRowClick={openEditor}
            />
          </div>
        </div>
      )}

      {/* ── transactions ── */}
      {tab === 'transactions' && (
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="band">
            <span className="t">Transaction ledger</span>
            <span className="ml-auto"><SearchInput value={q} onChange={setQ} placeholder="Search by reference or provider" /></span>
          </div>
          <div className="p-4">
            <DataGrid
              columns={txColumns}
              rows={txs?.filter((t) => rowMatches(t, TX_KEYS, q)) ?? null}
              empty={q.trim() ? 'No payments match your search' : 'No payments yet'}
            />
          </div>
        </div>
      )}

      {/* ── per-lender editor ── */}
      <Drawer
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Billing · ${editing.tenantName}` : ''}
        sub={editing ? `${editing.used}/${editing.capacity} clients · ${editing.planName}` : ''}
        width={440}
      >
        <FormGrid cols={2}>
          <Field label="Plan">
            <select
              className={inputCls}
              value={form.planKey}
              onChange={(e) => setForm({ ...form, planKey: e.target.value })}
            >
              {(plans ?? []).map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="active">active</option>
              <option value="grace">grace</option>
              <option value="past_due">past_due</option>
              <option value="suspended">suspended</option>
              <option value="cancelled">cancelled</option>
            </select>
          </Field>
          <Field label="Free clients (blank = plan)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.includedClientsOverride}
              onChange={(e) =>
                setForm({ ...form, includedClientsOverride: e.target.value })
              }
              placeholder="e.g. 10"
            />
          </Field>
          <Field label="Slot price, K (blank = plan)">
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.priceOverrideMinor}
              onChange={(e) => setForm({ ...form, priceOverrideMinor: e.target.value })}
              placeholder="e.g. 50"
            />
          </Field>
          <Field label="Promotion note (optional)" span={2}>
            <input
              type="text"
              className={inputCls}
              value={form.promoNote}
              onChange={(e) => setForm({ ...form, promoNote: e.target.value })}
              placeholder="e.g. First 50 customers free"
            />
          </Field>
          <Field label="Change reason (audited)" span={2}>
            <input
              type="text"
              className={inputCls}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Why is this changing?"
            />
          </Field>
        </FormGrid>

        <div className="mt-4 flex gap-2">
          <KitButton onClick={() => void saveLender()} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </KitButton>
          <KitButton tone="neutral" onClick={() => setEditing(null)}>
            Cancel
          </KitButton>
        </div>
        <p className="mt-3 text-[10.5px] leading-relaxed text-ink-muted">
          Leave a field blank to fall back to the plan's own value. Suspending a
          lender blocks new client additions immediately (403 on the API).
        </p>
      </Drawer>

      {lenders && lenders.length === 0 && tab === 'lenders' && (
        <Empty icon="💳" title="No lenders" hint="Approved lenders appear here." />
      )}
    </div>
  );
}
