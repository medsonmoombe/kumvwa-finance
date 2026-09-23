import { useCallback, useEffect, useState } from 'react';

import {
  Badge,
  Card,
  CenteredSpinner,
  ErrorBox,
  PageHead,
  Spinner,
} from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { money } from '../../lib/format';

interface Product {
  id: string;
  name: string;
  ratePct: number;
  minAmount: string;
  maxAmount: string;
  minAmountMinor: string;
  maxAmountMinor: string;
  minTerm: number;
  maxTerm: number;
  active: boolean;
}

export function SettingsPage() {
  const [items, setItems] = useState<Product[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api
      .get<{ items: Product[] }>('/loan-products')
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load loan products'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHead
        title="Settings"
        sub="Loan products define the rate and amount guard-rails for approvals"
        action={
          <button
            onClick={() => setCreating(!creating)}
            className="rounded-btn bg-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-c1 hover:bg-brand-900"
          >
            {creating ? 'Cancel' : '+ New Product'}
          </button>
        }
      />

      {error && <ErrorBox message={error} />}

      {creating && (
        <ProductForm
          onDone={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {!items ? (
        <CenteredSpinner />
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-[12.5px] text-ink-muted">
          No loan products yet — create your first one.
        </Card>
      ) : (
        <div className="space-y-2.5">
          {items.map((p) => (
            <Card key={p.id} className="flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 font-display text-[15px] font-extrabold text-brand-600">
                {p.ratePct}%
              </div>
              <div className="min-w-0 flex-1">
                <b className="block text-[13px]">{p.name}</b>
                <span className="text-[11.5px] tabular-nums text-ink-muted">
                  {money(p.minAmountMinor)} – {money(p.maxAmountMinor)} ·{' '}
                  {p.minTerm}–{p.maxTerm} months
                </span>
              </div>
              <Badge color={p.active ? 'green' : 'grey'} dot>
                {p.active ? 'Active' : 'Inactive'}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [ratePct, setRatePct] = useState(15);
  const [minAmount, setMinAmount] = useState('500');
  const [maxAmount, setMaxAmount] = useState('10000');
  const [minTerm, setMinTerm] = useState(1);
  const [maxTerm, setMaxTerm] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.post('/loan-products', {
        name,
        rateBps: Math.round(ratePct * 100),
        minAmount: Number(minAmount),
        maxAmount: Number(maxAmount),
        minTerm,
        maxTerm,
      });
      onDone();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-input border-[1.5px] border-line bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand-500';
  const label = 'mb-1 block text-[11.5px] font-semibold text-ink';

  return (
    <Card className="mb-4 p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={label}>Product name</label>
          <input
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency Loan"
          />
        </div>
        <div>
          <label className={label}>Interest rate (% flat)</label>
          <input
            type="number"
            className={input}
            value={ratePct}
            min={0}
            max={100}
            step={0.5}
            onChange={(e) => setRatePct(Number(e.target.value))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Min amount (K)</label>
            <input
              type="number"
              className={input}
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>
          <div>
            <label className={label}>Max amount (K)</label>
            <input
              type="number"
              className={input}
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Min term (months)</label>
            <input
              type="number"
              className={input}
              value={minTerm}
              min={1}
              max={60}
              onChange={(e) => setMinTerm(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={label}>Max term (months)</label>
            <input
              type="number"
              className={input}
              value={maxTerm}
              min={1}
              max={60}
              onChange={(e) => setMaxTerm(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ErrorBox message={error} />
        </div>
      )}
      <button
        disabled={busy || !name.trim()}
        onClick={submit}
        className="mt-3 flex h-[46px] w-full items-center justify-center rounded-btn bg-brand-600 font-bold text-white hover:bg-brand-900 disabled:opacity-40"
      >
        {busy ? <Spinner className="border-white" /> : 'Create Product'}
      </button>
    </Card>
  );
}
