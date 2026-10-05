import { useCallback, useEffect, useState } from 'react';

import { Drawer, Field, FormGrid, KitButton, StatBand } from '../../components/kit';
import { inputCls, ProgressBar } from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { date, money } from '../../lib/format';

interface BillingMe {
  plan: {
    key: string;
    name: string;
    includedClients: number;
    pricePerExtraClientMinor: string;
    pricePerExtraClient: string;
    interval: string;
  };
  status: string;
  slotsExpireAt: string | null;
  promoNote: string | null;
  capacity: {
    capacity: number;
    used: number;
    remaining: number;
    canAddClient: boolean;
    atLimit: boolean;
    blocked: boolean;
    unitPriceMinor: string;
    unitPrice: string;
  };
}

interface SlotPurchase {
  id: string;
  count: number;
  amountMinor: string;
  amount: string;
  status: string;
  periodEnd: string;
  createdAt: string;
}

/** A payment intent as the API reports it. */
interface Intent {
  id: string;
  reference: string;
  status: string;
  amount: string;
  amountMinor: string;
  method: 'mobile_money' | 'card';
  provider: string;
  payerPhone: string | null;
  failureReason: string | null;
}

const RAILS = [
  { id: 'mtn_momo', label: 'MTN MoMo', method: 'mobile_money' as const },
  { id: 'airtel_money', label: 'Airtel Money', method: 'mobile_money' as const },
  { id: 'zamtel_kwacha', label: 'Zamtel Kwacha', method: 'mobile_money' as const },
  { id: 'card_psp', label: 'Card', method: 'card' as const },
];

const PROVIDER_LABEL: Record<string, string> = {
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  zamtel_kwacha: 'Zamtel Kwacha',
  card_psp: 'Card',
  sandbox: 'Test rail',
};

type Step = 'form' | 'paying' | 'done';

/**
 * Lender billing: how many clients the plan covers, how many are used, and
 * buying extra slots. Buying raises a `client_slots` payment intent — the API
 * prices it (K100 × N) and charges the lender's own number over the rail they
 * pick. The console never marks a slot paid; it only reflects what the
 * payments engine confirms.
 */
export function BillingTab({
  onFlash,
  onError,
}: {
  onFlash: (m: string) => void;
  onError: (m: string) => void;
}) {
  const [me, setMe] = useState<BillingMe | null>(null);
  const [purchases, setPurchases] = useState<SlotPurchase[]>([]);
  const [count, setCount] = useState('1');
  const [quote, setQuote] = useState<{ total: string; unitPrice: string } | null>(null);
  const [checkout, setCheckout] = useState(false);

  const load = useCallback(() => {
    api
      .get<BillingMe>('/billing/me')
      .then((r) => setMe(r.data))
      .catch((e) => onError(apiError(e)));
    api
      .get<{ items: SlotPurchase[] }>('/billing/slots')
      .then((r) => setPurchases(r.data.items))
      .catch(() => undefined);
  }, [onError]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshQuote(n: number) {
    if (!Number.isInteger(n) || n <= 0) {
      setQuote(null);
      return;
    }
    try {
      const r = await api.post<{ total: string; unitPrice: string }>(
        '/billing/slots/quote',
        { count: n },
      );
      setQuote(r.data);
    } catch {
      setQuote(null);
    }
  }

  if (!me) {
    return <p className="py-6 text-[12px] text-ink-muted">Loading billing…</p>;
  }

  const slots = Number(count);
  const validCount = Number.isInteger(slots) && slots > 0;
  const total = quote?.total ?? (validCount ? (slots * Number(me.capacity.unitPrice)).toFixed(2) : '—');

  const pct =
    me.capacity.capacity === 0
      ? 100
      : Math.min(100, Math.round((me.capacity.used / me.capacity.capacity) * 100));

  return (
    <div>
      <StatBand
        cols={4}
        items={[
          { label: 'Plan', value: me.plan.name },
          { label: 'Free clients', value: String(me.plan.includedClients) },
          { label: 'Clients used', value: String(me.capacity.used) },
          { label: 'Extra slot price', value: `${me.capacity.unitPrice}/mo` },
        ]}
      />

      <div className="mb-4 overflow-hidden rounded-card border border-line bg-white">
        <div className="band">
          <span className="t">Client capacity</span>
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between text-[12px]">
            <b>
              {me.capacity.used} of {me.capacity.capacity} clients used
            </b>
            <span className="text-ink-muted">{me.capacity.remaining} left</span>
          </div>
          <ProgressBar pct={pct} danger={me.capacity.atLimit} />
          {me.capacity.blocked ? (
            <p className="mt-2 text-[11.5px] font-semibold text-danger-600">
              Your account is suspended — contact Kumvwa to resume lending.
            </p>
          ) : me.capacity.atLimit ? (
            <p className="mt-2 text-[11.5px] text-ink-muted">
              You have reached your free limit. Buy extra client slots below to
              keep adding clients (first {me.plan.includedClients} are free, then{' '}
              <b>{me.capacity.unitPrice}/client/month</b>).
            </p>
          ) : (
            <p className="mt-2 text-[11.5px] text-ink-muted">
              Every client beyond your free{' '}
              <b>
                {me.plan.includedClients}
                {me.slotsExpireAt ? ' + paid slots' : ''}
              </b>{' '}
              costs {me.capacity.unitPrice} per month. Paid slots last one month.
            </p>
          )}
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-card border border-line bg-white">
        <div className="band">
          <span className="t">Buy extra client slots</span>
        </div>
        <div className="p-4">
          <FormGrid cols={3}>
            <Field label="Slots this month">
              <input
                type="number"
                min={1}
                className={inputCls}
                value={count}
                onChange={(e) => {
                  setCount(e.target.value);
                  void refreshQuote(Number(e.target.value));
                }}
                placeholder="e.g. 2"
              />
            </Field>
            <Field label="Total today">
              <input className={inputCls} readOnly value={quote ? `K${total}` : '—'} />
            </Field>
            <div className="flex items-end">
              <KitButton onClick={() => setCheckout(true)} disabled={!validCount}>
                Continue to payment
              </KitButton>
            </div>
          </FormGrid>
          <p className="mt-3 text-[11px] text-ink-muted">
            You pick the rail on the next step — MTN MoMo, Airtel Money, Zamtel
            Kwacha or card. Slots activate the moment the payment confirms and
            last one month. The first {me.plan.includedClients} clients are free.
          </p>
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-card border border-line bg-white">
        <div className="band">
          <span className="t">Slot purchases</span>
        </div>
        <div className="p-4">
          {purchases.length === 0 ? (
            <p className="py-5 text-center text-[12px] text-ink-muted">
              No slot purchases yet.
            </p>
          ) : (
            purchases.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b border-line-2 py-2 text-[12px] last:border-0"
              >
                <div>
                  <b className="block">
                    {p.count} slot{p.count === 1 ? '' : 's'}
                  </b>
                  <span className="text-[10.5px] text-ink-muted">
                    bought {date(p.createdAt)} · valid until {date(p.periodEnd)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10.5px] font-semibold ${
                      p.status === 'active' ? 'text-accent-700' : 'text-ink-muted'
                    }`}
                  >
                    {p.status}
                  </span>
                  <b className="tabular-nums">{money(p.amountMinor)}</b>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {me.promoNote && (
        <div className="mb-4 rounded-card border border-[#E7EAF1] bg-[#F5F6F8] px-3.5 py-2.5 text-[12px] text-ink-muted">
          Promotion applied: <b>{me.promoNote}</b>
        </div>
      )}

      <SlotCheckoutDrawer
        open={checkout}
        onClose={() => setCheckout(false)}
        me={me}
        slots={slots}
        total={total}
        onPaid={(n) => {
          onFlash(
            `Paid for ${n} extra client slot${n === 1 ? '' : 's'} — you can add more clients now`,
          );
          setCount('1');
          setQuote(null);
          setCheckout(false);
          load();
        }}
      />
    </div>
  );
}

/**
 * The slot purchase itself. Deliberately a multi-step flow, because taking a
 * lender's money is the most sensitive thing this console does:
 *
 *  form   → choose the rail, confirm the amount, enter the paying number
 *  paying → the live state of the charge, driven by the server (never assumed)
 *  done   → the receipt, or a plain-language failure with a retry
 *
 * The status is *polled from the API*, which re-syncs against the provider, so
 * the console can never show "paid" for a charge that did not settle.
 */
function SlotCheckoutDrawer({
  open,
  onClose,
  me,
  slots,
  total,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  me: BillingMe;
  slots: number;
  total: string;
  onPaid: (count: number) => void;
}) {
  const [step, setStep] = useState<Step>('form');
  const [rail, setRail] = useState(RAILS[0]!.id);
  const [phone, setPhone] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [status, setStatus] = useState<string>('');
  const [outcome, setOutcome] = useState<'paid' | 'failed' | 'pending' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset whenever the drawer is reopened.
  useEffect(() => {
    if (open) {
      setStep('form');
      setIntent(null);
      setStatus('');
      setOutcome(null);
      setFailure(null);
      setBusy(false);
    }
  }, [open]);

  const chosen = RAILS.find((r) => r.id === rail) ?? RAILS[0]!;
  const needsPhone = chosen.method === 'mobile_money';
  const canPay = slots > 0 && (!needsPhone || phone.trim().length >= 9);

  async function pay() {
    setBusy(true);
    setFailure(null);
    setStep('paying');
    setStatus('requires_action');
    const key = `slots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const res = await api.post<Intent>(
        '/payments/intents',
        {
          purpose: 'client_slots',
          slotCount: slots,
          provider: chosen.id,
          method: chosen.method,
          ...(needsPhone && phone.trim() ? { phone: phone.trim() } : {}),
        },
        { headers: { 'Idempotency-Key': key } },
      );
      setIntent(res.data);
      setStatus(res.data.status);
      await poll(res.data.id);
    } catch (e) {
      setStep('done');
      setOutcome('failed');
      setFailure(apiError(e));
      setBusy(false);
    }
  }

  /** Poll the intent until it settles; the API re-checks the provider each read. */
  async function poll(id: string) {
    const terminal = new Set([
      'succeeded',
      'failed',
      'cancelled',
      'expired',
      'refunded',
      'partially_refunded',
    ]);
    let last = 'requires_action';
    let reason: string | null = null;
    for (let i = 0; i < 40; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const r = await api.get<Intent>(`/payments/intents/${id}`);
        setIntent(r.data);
        setStatus(r.data.status);
        last = r.data.status;
        reason = r.data.failureReason;
      } catch {
        continue; // transient read failure — keep polling
      }
      if (terminal.has(last)) break;
    }
    setBusy(false);
    setStep('done');
    if (last === 'succeeded') {
      setOutcome('paid');
      onPaid(slots);
    } else if (last === 'failed' || last === 'cancelled' || last === 'expired') {
      setOutcome('failed');
      setFailure(reason ?? 'The payment did not go through. No money was taken.');
    } else {
      // Still requires_action/processing after the window: genuinely unknown.
      setOutcome('pending');
    }
  }

  /** Manual re-check for a payment that was still moving when the window closed. */
  async function loadAndRecheck() {
    if (!intent) return;
    setStep('paying');
    setBusy(true);
    setOutcome(null);
    await poll(intent.id);
  }

  async function cancel() {
    if (!intent) return;
    try {
      await api.post(`/payments/intents/${intent.id}/cancel`);
    } catch {
      /* best-effort */
    }
    setStep('done');
    setOutcome('failed');
    setFailure('Payment cancelled. No money was taken.');
    setBusy(false);
  }

  return (
    <Drawer
      open={open}
      onClose={() => !busy && onClose()}
      title="Buy client slots"
      sub={`${slots} slot${slots === 1 ? '' : 's'} · K${total} · renews monthly`}
      width={440}
    >
      <CheckoutSteps step={step} />

      {step === 'form' && (
        <>
          <div className="mb-3 rounded-card border border-line bg-surface p-3.5 text-[12px]">
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">
                {slots} slot{slots === 1 ? '' : 's'} × {me.capacity.unitPrice}
              </span>
              <b className="tabular-nums">K{total}</b>
            </div>
            <div className="flex justify-between border-t border-line-2 pt-2">
              <b>Pay today</b>
              <b className="tabular-nums text-brand-600">K{total}</b>
            </div>
            <p className="mt-1.5 text-[10.5px] text-ink-muted">
              Free plan includes {me.plan.includedClients} clients. Slots last one
              month from activation.
            </p>
          </div>

          <Field label="Payment method" span={1}>
            <div className="grid grid-cols-2 gap-2">
              {RAILS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRail(r.id)}
                  className={`rounded-[3px] border px-3 py-2.5 text-left text-[12px] font-semibold transition-colors ${
                    rail === r.id
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-line bg-white text-ink-2 hover:border-brand-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          {needsPhone ? (
            <div className="mt-3">
              <Field label="Mobile money number">
                <input
                  className={inputCls}
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 097 000 0000"
                />
              </Field>
              <p className="mt-1.5 text-[10.5px] text-ink-muted">
                We push a prompt to this number to approve the charge. Leave it
                blank to use the number on your account.
              </p>
            </div>
          ) : (
            <p className="mt-3 rounded-[3px] border border-line bg-surface px-3 py-2.5 text-[11px] text-ink-muted">
              You will be taken through the card provider's secure page to enter
              your card details. We never see your card number.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <KitButton onClick={() => void pay()} disabled={!canPay}>
              Pay K{total}
            </KitButton>
            <KitButton tone="neutral" onClick={onClose}>
              Cancel
            </KitButton>
          </div>
        </>
      )}

      {step === 'paying' && (
        <div>
          <StatusRow
            title={
              status === 'requires_action' && chosen.method === 'mobile_money'
                ? 'Approve the prompt on your phone'
                : status === 'requires_action'
                  ? 'Complete the payment'
                  : 'Processing your payment'
            }
            sub={
              status === 'requires_action' && chosen.method === 'mobile_money'
                ? `We sent a ${chosen.label} request to ${intent?.payerPhone ?? (phone || 'your registered number')}. Enter your PIN to approve.`
                : 'Please wait — do not close this window.'
            }
            tone="busy"
          />
          <div className="mt-3 rounded-[3px] border border-line bg-surface px-3.5 py-3 text-[11.5px]">
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">Amount</span>
              <b className="tabular-nums">K{intent?.amount ?? total}</b>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-ink-muted">Rail</span>
              <b>{PROVIDER_LABEL[intent?.provider ?? chosen.id] ?? chosen.label}</b>
            </div>
            {intent && (
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Reference</span>
                <b className="tabular-nums">{intent.reference}</b>
              </div>
            )}
          </div>
          <div className="mt-4">
            <KitButton tone="neutral" onClick={() => void cancel()} disabled={!intent}>
              Cancel payment
            </KitButton>
          </div>
        </div>
      )}

      {step === 'done' &&
        outcome === 'pending' ? (
          <div>
            <StatusRow
              title="Still confirming"
              sub="The payment has not settled yet. It will be confirmed shortly — you do not need to pay again."
              tone="busy"
            />
            <div className="mt-4 flex gap-2">
              <KitButton onClick={onClose}>Close</KitButton>
              <KitButton tone="neutral" onClick={() => void loadAndRecheck()}>
                Check status
              </KitButton>
            </div>
          </div>
        ) : step === 'done' && failure ? (
          <div>
            <StatusRow title="Payment not completed" sub={failure} tone="bad" />
            <div className="mt-4 flex gap-2">
              <KitButton
                onClick={() => {
                  setStep('form');
                  setOutcome(null);
                  setFailure(null);
                  setIntent(null);
                }}
              >
                Try again
              </KitButton>
              <KitButton tone="neutral" onClick={onClose}>
                Close
              </KitButton>
            </div>
          </div>
        ) : step === 'done' ? (
          <div>
            <StatusRow
              title="Payment received"
              sub={`${slots} client slot${slots === 1 ? '' : 's'} added — you can invite more clients right away.`}
              tone="good"
            />
            <div className="mt-3 rounded-[3px] border border-line bg-surface px-3.5 py-3 text-[11.5px]">
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Amount paid</span>
                <b className="tabular-nums">K{intent?.amount ?? total}</b>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Reference</span>
                <b className="tabular-nums">{intent?.reference ?? '—'}</b>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-muted">Rail</span>
                <b>{PROVIDER_LABEL[intent?.provider ?? chosen.id] ?? chosen.label}</b>
              </div>
            </div>
            <div className="mt-4">
              <KitButton onClick={onClose}>Done</KitButton>
            </div>
          </div>
        ) : null}
    </Drawer>
  );
}

function CheckoutSteps({ step }: { step: Step }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: 'form', label: 'Details' },
    { id: 'paying', label: 'Payment' },
    { id: 'done', label: 'Receipt' },
  ];
  const activeIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-4 flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center gap-1.5">
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              i <= activeIdx ? 'bg-brand-600 text-white' : 'bg-[#E7EAF1] text-ink-muted'
            }`}
          >
            {i + 1}
          </span>
          <span
            className={`text-[10.5px] font-semibold ${
              i <= activeIdx ? 'text-ink' : 'text-ink-muted'
            }`}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="h-px flex-1 bg-[#E7EAF1]" />}
        </div>
      ))}
    </div>
  );
}

function StatusRow({
  title,
  sub,
  tone,
}: {
  title: string;
  sub: string;
  tone: 'busy' | 'good' | 'bad';
}) {
  const color =
    tone === 'good' ? 'text-accent-700' : tone === 'bad' ? 'text-danger-600' : 'text-brand-600';
  const dot =
    tone === 'good' ? 'bg-accent-500' : tone === 'bad' ? 'bg-danger-500' : 'bg-brand-500';
  return (
    <div className="flex items-start gap-3 rounded-card border border-line bg-white p-3.5">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full ${dot}`} />
      <div>
        <b className={`block text-[13px] font-bold ${color}`}>{title}</b>
        <span className="text-[11.5px] text-ink-muted">{sub}</span>
      </div>
    </div>
  );
}
