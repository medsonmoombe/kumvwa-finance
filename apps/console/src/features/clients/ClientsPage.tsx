import { useEffect, useState } from 'react';
import { FiCheck, FiCopy, FiPlus, FiSearch, FiUsers } from 'react-icons/fi';

import {
  Avatar,
  Badge,
  Card,
  CenteredSpinner,
  Empty,
  ErrorBox,
  PageHead,
  Spinner,
} from '../../components/ui';
import { api, apiError } from '../../lib/api';

interface ClientRow {
  id: string;
  name: string;
  nrcMasked: string;
  phone: string;
  status: string;
  lendersCount: number;
  activeLoans: number;
  overdueLoans: number;
  totalLoans: number;
  linkedAt: string;
}

export function ClientsPage() {
  const [items, setItems] = useState<ClientRow[] | null>(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get<{ items: ClientRow[] }>('/clients', { params: q ? { q } : {} })
        .then((r) => setItems(r.data.items))
        .catch(() => setError('Could not load clients'));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHead
        title="Clients"
        sub={
          items
            ? `${items.length} linked borrowers · deduped by NRC platform-wide`
            : undefined
        }
        action={
          <button
            onClick={() => setInviting(true)}
            className="flex items-center gap-2 rounded-btn bg-brand-600 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-c1 hover:bg-brand-900"
          >
            <FiPlus size={14} /> Invite Client
          </button>
        }
      />

      <div className="relative mb-3">
        <FiSearch
          size={14}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          className="w-full rounded-input border-[1.5px] border-line bg-white py-2.5 pl-10 pr-4 text-[13px] outline-none focus:border-brand-500"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone…"
        />
      </div>

      {error && <ErrorBox message={error} />}

      {!items ? (
        <CenteredSpinner />
      ) : items.length === 0 ? (
        <Card>
          <Empty
            icon={<FiUsers />}
            title="No clients found"
            hint="Invite your first borrower with the button above"
          />
        </Card>
      ) : (
        <Card>
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFBFD] text-left text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                <th className="px-4 py-2.5">Client</th>
                <th className="px-4 py-2.5">Phone</th>
                <th className="px-4 py-2.5 text-right">Loans</th>
                <th className="px-4 py-2.5 text-right">Lenders</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-line-2 text-[12.5px] hover:bg-[#FAFBFE]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={c.name} size={32} />
                      <div>
                        <b className="font-semibold">{c.name}</b>
                        <div className="text-[10.5px] text-ink-muted">
                          {c.status}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-muted">
                    {c.phone}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-ink-2">
                    {c.totalLoans}
                    {c.overdueLoans > 0 && (
                      <span className="ml-1.5 font-bold text-danger-500">
                        {c.overdueLoans} overdue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge color="blue">
                      {c.lendersCount} lender{c.lendersCount === 1 ? '' : 's'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} />}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<{
    code: string;
    link: string;
  } | null>(null);
  const [copied, setCopied] = useState('');

  async function create() {
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ code: string; token: string; link: string }>(
        '/invites',
        { clientName: name, phone, email },
      );
      setInvite({
        code: res.data.code ?? res.data.token,
        link: res.data.link,
      });
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-input border-[1.5px] border-line bg-white px-4 py-3 text-[14px] outline-none focus:border-brand-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1426]/45 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-c3"
        onClick={(e) => e.stopPropagation()}
      >
        {!invite ? (
          <>
            <h2 className="font-display text-[17px] font-bold">
              Invite a client
            </h2>
            <p className="mb-5 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              They'll receive an email with an app download link plus a unique
              invite code. In the app they set their name, password and complete
              their profile, then appear in your Clients list.
            </p>
            <div className="space-y-3">
              <input
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Client full name"
              />
              <input
                className={`${input} tabular-nums`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0971234567"
              />
              <input
                className={input}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
              {error && <ErrorBox message={error} />}
              <button
                disabled={busy || !name || !phone || !email}
                onClick={create}
                className="flex h-[50px] w-full items-center justify-center rounded-btn bg-brand-600 font-bold text-white hover:bg-brand-900 disabled:opacity-40"
              >
                {busy ? (
                  <Spinner className="border-white" />
                ) : (
                  'Create Invite Code'
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-50 text-accent-700">
              <FiCheck size={20} />
            </div>
            <h2 className="font-display text-[17px] font-bold text-accent-700">
              Invite created
            </h2>
            <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              Send both of these to <b className="text-ink">{name}</b>: the
              app download link, and the code to redeem in-app. SMS delivery
              activates with the provider keys — share via WhatsApp for now.
            </p>

            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Invite code
            </p>
            <div className="mb-3 rounded-xl border border-brand-100 bg-brand-50 p-3.5 text-center text-[18px] font-bold tracking-[0.2em] text-brand-600">
              {invite.code}
            </div>

            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              Download the app
            </p>
            <div className="mb-4 break-all rounded-xl border border-brand-100 bg-white p-3.5 text-center text-[12px] font-bold text-brand-600">
              {invite.link}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(invite.code);
                  setCopied('code');
                }}
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-btn border-[1.5px] border-brand-100 font-bold text-brand-600 hover:bg-brand-50"
              >
                {copied === 'code' ? <FiCheck size={14} /> : <FiCopy size={14} />}{' '}
                {copied === 'code' ? 'Copied' : 'Copy Code'}
              </button>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(invite.link);
                  setCopied('link');
                }}
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-btn border-[1.5px] border-brand-100 font-bold text-brand-600 hover:bg-brand-50"
              >
                {copied === 'link' ? <FiCheck size={14} /> : <FiCopy size={14} />}{' '}
                {copied === 'link' ? 'Copied' : 'Copy Download Link'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
