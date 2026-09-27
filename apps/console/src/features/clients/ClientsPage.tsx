import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiCopy, FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { Avatar, Badge, ErrorBox, Spinner, inputCls } from '../../components/ui';
import {
  AppTable, Drawer, Field, PageActionBar, Pill,
  StatBand, StatBandSkeleton, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';

interface ClientRow {
  id: string; name: string; nrcMasked: string | null; phone: string;
  status: string; lendersCount: number; activeLoans: number;
  overdueLoans: number; totalLoans: number; linkedAt: string;
}

export function ClientsPage() {
  const [items, setItems] = useState<ClientRow[] | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);
  const nav = useNavigate();

  const load = useCallback((q = '') => {
    api.get<{ items: ClientRow[] }>('/clients', { params: q ? { q } : {} })
      .then((r) => setItems(r.data.items))
      .catch(() => setError('Could not load clients'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const overdue = items?.reduce((s, c) => s + c.overdueLoans, 0) ?? 0;
  const active  = items?.reduce((s, c) => s + c.activeLoans, 0) ?? 0;
  const total   = items?.reduce((s, c) => s + c.totalLoans, 0) ?? 0;

  const visible = filter === 'overdue'
    ? (items?.filter((c) => c.overdueLoans > 0) ?? null)
    : filter === 'active'
      ? (items?.filter((c) => c.activeLoans > 0) ?? null)
      : items;

  const columns: Array<Column<ClientRow>> = [
    {
      key: 'name', header: 'Client', width: '32%',
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={c.name} size={28} />
          <div>
            <b className="block font-semibold">{c.name}</b>
            <span className="text-[10.5px] tabular-nums text-ink-muted">
              {c.nrcMasked ?? 'no NRC yet'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone', header: 'Phone',
      render: (c) => <span className="tabular-nums text-ink-muted">{c.phone}</span>,
    },
    {
      key: 'loans', header: 'Loans',
      render: (c) => (
        <span className="tabular-nums">
          {c.totalLoans}
          {c.overdueLoans > 0 && (
            <span className="ml-1.5 font-bold text-danger-500">{c.overdueLoans} overdue</span>
          )}
        </span>
      ),
    },
    {
      key: 'lenders', header: 'Lenders',
      render: (c) => <span className="tabular-nums text-ink-2">{c.lendersCount}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: (c) => (
        <Badge color={c.status === 'active' ? 'green' : 'red'} dot>{c.status}</Badge>
      ),
    },
  ];

  return (
    <div>
      <PageActionBar
        title="Clients"
        sub={items ? `${items.length} linked borrowers · deduplicated by NRC platform-wide` : undefined}
        actions={
          <Pill onClick={() => setInviting(true)}>
            <FiPlus size={11} /> Invite Client
          </Pill>
        }
      />

      {items ? (
        <StatBand
          cols={4}
          items={[
            { label: 'Total clients', value: String(items.length) },
            { label: 'Active loans', value: String(active), color: '#2E7D32' },
            { label: 'Overdue loans', value: String(overdue), color: overdue > 0 ? '#C02828' : undefined },
            { label: 'Total loans', value: String(total) },
          ]}
        />
      ) : (
        <StatBandSkeleton cols={4} />
      )}

      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <AppTable
        columns={columns}
        rows={visible}
        onSearch={(q) => load(q)}
        filters={[
          { value: '', label: 'All' },
          { value: 'active', label: 'Active loans' },
          { value: 'overdue', label: 'Overdue' },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        onRefresh={() => load()}
        onRowClick={(c) => nav(`/clients/${c.id}`)}
        empty="No clients yet. Invite your first borrower."
        pageSize={25}
      />

      <Drawer
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a Client"
        sub="The client receives an invite code to redeem in the app."
      >
        <InviteForm
          onDone={() => {
            setItems(null);
            load();
          }}
        />
      </Drawer>
    </div>
  );
}

// ── Invite form (inside Drawer) ───────────────────────────────────────────────

function InviteForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null);
  const [copied, setCopied] = useState('');

  async function create() {
    setBusy(true); setError('');
    try {
      const res = await api.post<{ code: string; token: string; link: string }>(
        '/invites',
        { clientName: name, phone, email },
      );
      setInvite({ code: res.data.code ?? res.data.token, link: res.data.link });
      onDone();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  }

  if (invite) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-[3px] border border-emerald-200 bg-accent-50 px-3 py-2.5 text-[12px] font-semibold text-accent-700">
          <FiCheck size={14} /> Invite created for <b>{name}</b>
        </div>

        {/* invite code */}
        <div>
          <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
            Invite code
          </div>
          <div className="flex items-center justify-between rounded-[3px] border border-line bg-surface px-3 py-2.5">
            <span className="font-mono text-[16px] font-bold tracking-[0.18em] text-brand-600">
              {invite.code}
            </span>
            <button
              onClick={() => copy(invite.code, 'code')}
              className="flex items-center gap-1 text-[10.5px] font-bold text-brand-600 hover:text-brand-900"
            >
              {copied === 'code' ? <FiCheck size={12} /> : <FiCopy size={12} />}
              {copied === 'code' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* app link */}
        <div>
          <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-ink-muted">
            App link
          </div>
          <div className="flex items-center justify-between rounded-[3px] border border-line bg-surface px-3 py-2.5">
            <span className="truncate text-[11px] text-brand-600">{invite.link}</span>
            <button
              onClick={() => copy(invite.link, 'link')}
              className="ml-2 flex shrink-0 items-center gap-1 text-[10.5px] font-bold text-brand-600 hover:text-brand-900"
            >
              {copied === 'link' ? <FiCheck size={12} /> : <FiCopy size={12} />}
              {copied === 'link' ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        <p className="text-[10.5px] text-ink-muted">
          Share via WhatsApp for now — SMS activates with provider keys.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11.5px] text-ink-muted">
        The client receives an invite code to redeem in the Kumvwa app.
        They complete their profile and appear in your clients list.
      </p>

      <Field label="Client full name" required>
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mwansa Banda"
          autoFocus
        />
      </Field>

      <Field label="Phone number" required>
        <input
          className={`${inputCls} tabular-nums`}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          placeholder="0971234567"
          inputMode="numeric"
          type="tel"
        />
      </Field>

      <Field label="Email address" required>
        <input
          className={inputCls}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="client@example.com"
        />
      </Field>

      {error && <ErrorBox message={error} />}

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Pill
          disabled={busy || !name.trim() || !phone.trim() || !email.trim()}
          onClick={create}
        >
          {busy ? <Spinner className="border-white" /> : 'Create Invite Code'}
        </Pill>
      </div>
    </div>
  );
}
