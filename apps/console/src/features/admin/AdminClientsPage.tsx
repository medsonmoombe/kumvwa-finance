import { useEffect, useState } from 'react';
import { FiSearch } from 'react-icons/fi';

import { Badge, ErrorBox, PageHead } from '../../components/ui';
import { DataGrid, type Column } from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { money } from '../../lib/format';

/** Tiny guard so the modal reads as intent, not a truthiness accident. */
function showPhoto(url: string | null): boolean {
  return url !== null && url.length > 0;
}

interface Row {
  id: string; name: string; phone: string; email: string | null;
  status: string; lenders: number; loans: number; overdue: number; accountStatus: string;
}
interface Detail {
  id: string; name: string; phone: string; email: string | null; status: string;
  createdAt: string;  nrc: string | null; dob: string | null; address: string | null;
  documents: Array<{ id: string; kind: string; mime: string; size: number; side: 'front' | 'back'; createdAt: string }>;
  employmentStatus: string | null; incomeBand: string | null; incomeSource: string | null;
  kinName: string | null; kinPhone: string | null; profileCompletedAt: string | null;
  lenders: Array<{ id: string; name: string; status: string; linkedAt: string }>;
  accountStatus: string;
  loans: Array<{
    id: string; loanRef: string; status: string; principalMinor: string;
    outstandingMinor: string; createdAt: string;
    lender: { id: string; name: string; status: string };
    repayments: Array<{ id: string; amountMinor: string; kind: string; method: string; reference: string | null; recordedAt: string }>;
  }>;
}

export function AdminClientsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Detail | null>(null);
  // Which face is open in the photo viewer, plus its freshly minted URL.
  const [photoSide, setPhotoSide] = useState<'front' | 'back'>('front');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.get<{ items: Row[] }>('/admin/clients', { params: q ? { q } : {} })
        .then((r) => setRows(r.data.items))
        .catch(() => setError('Could not load borrowers'));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  async function open(id: string) {
    try {
      const res = await api.get<Detail>(`/admin/clients/${id}`);
      setSelected(res.data);
      setPhotoUrl(null);
    } catch (e) { setError(apiError(e)); }
  }

  // Presigned per open — a URL held from a previous look is already stale,
  // and every reveal of a borrower's ID is its own audit entry.
  async function viewNrc(side: 'front' | 'back') {
    if (!selected) return;
    setError('');
    try {
      const res = await api.get<{ url: string }>(`/admin/clients/${selected.id}/nrc-photo?side=${side}`);
      setPhotoSide(side);
      setPhotoUrl(res.data.url);
    } catch (e) { setPhotoUrl(null); setError(apiError(e)); }
  }

  const columns: Array<Column<Row>> = [
    {
      key: 'n', header: 'Borrower', width: '34%',
      render: (c) => (
        <div>
          <b className="block font-semibold">{c.name}</b>
          <span className="text-[10.5px] tabular-nums text-ink-muted">{c.phone}</span>
        </div>
      ),
    },
    { key: 'l', header: 'Lenders', render: (c) => <span className="tabular-nums">{c.lenders}</span> },
    {
      key: 'lo', header: 'Loans',
      render: (c) => (
        <span className="tabular-nums">
          {c.loans}
          {c.overdue > 0 && <span className="ml-1.5 font-bold text-danger-500">{c.overdue} overdue</span>}
        </span>
      ),
    },
    {
      key: 'st', header: 'Account',
      render: (c) => (
        <Badge color={c.accountStatus === 'active' ? 'green' : 'grey'} dot>
          {c.accountStatus}
        </Badge>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Borrowers" sub="Platform-wide client identities, deduplicated by NRC. Read-only oversight." />
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <div className="mb-3 max-w-sm">
        <div className="relative">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="h-[32px] w-full rounded-[3px] border border-line bg-white pl-9 pr-3 text-[12.5px] outline-none focus:border-brand-500"
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
        <DataGrid columns={columns} rows={rows} onRowClick={(c) => void open(c.id)}
          empty="No borrowers yet" />
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-[#0D1426]/40" onClick={() => setSelected(null)}>
          <aside
            className="absolute right-0 top-0 flex h-full w-[400px] max-w-full flex-col overflow-y-auto border-l border-line bg-white p-4 sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between">
              <div>
                <h3 className="font-display text-[16px] font-bold">{selected.name}</h3>
                <p className="text-[11px] tabular-nums text-ink-muted">{selected.phone}</p>
              </div>
              <Badge color={selected.accountStatus === 'active' ? 'green' : 'grey'} dot>
                {selected.accountStatus}
              </Badge>
            </div>

            <div className="mt-3">
              <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-ink-muted">
                Identity and profile
              </div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                <div><dt className="text-ink-muted">NRC</dt><dd className="font-semibold">{selected.nrc ?? 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">NRC photos</dt>
                  <dd className="font-semibold">
                    {selected.documents.length === 0 ? 'Not uploaded' : (
                      <span className="flex flex-wrap gap-x-2">
                        {selected.documents.map((d) => (
                          <button key={d.id} onClick={() => void viewNrc(d.side)}
                            className="font-bold text-brand-600 underline">
                            {d.side} ({(d.size / 1024).toFixed(0)} KB)
                          </button>
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
                <div><dt className="text-ink-muted">Email</dt><dd className="break-words font-semibold">{selected.email ?? 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">Date of birth</dt><dd className="font-semibold">{selected.dob ? new Date(selected.dob).toLocaleDateString() : 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">Profile</dt><dd className="font-semibold">{selected.profileCompletedAt ? 'Completed' : 'Incomplete'}</dd></div>
                <div className="col-span-2"><dt className="text-ink-muted">Address</dt><dd className="font-semibold">{selected.address ?? 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">Employment</dt><dd className="font-semibold capitalize">{selected.employmentStatus?.replaceAll('_', ' ') ?? 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">Income band</dt><dd className="font-semibold capitalize">{selected.incomeBand?.replaceAll('_', ' ') ?? 'Not provided'}</dd></div>
                <div className="col-span-2"><dt className="text-ink-muted">Income source</dt><dd className="font-semibold">{selected.incomeSource ?? 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">Next of kin</dt><dd className="font-semibold">{selected.kinName ?? 'Not provided'}</dd></div>
                <div><dt className="text-ink-muted">Kin phone</dt><dd className="font-semibold">{selected.kinPhone ?? 'Not provided'}</dd></div>
              </dl>
            </div>

            <div className="mt-4">
              <div className="text-[9.5px] font-extrabold uppercase tracking-wide text-ink-muted">
                Lenders on platform
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.lenders.length === 0
                  ? <span className="text-[11.5px] text-ink-muted">None</span>
                  : selected.lenders.map((l) => <Badge key={l.id} color={l.status === 'active' ? 'blue' : 'grey'}>{l.name}</Badge>)}
              </div>
            </div>

            <div className="mt-4 text-[9.5px] font-extrabold uppercase tracking-wide text-ink-muted">
              Loans across the platform
            </div>
            {selected.loans.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-ink-muted">No loans</p>
            ) : (
              <div className="mt-1.5">
                {selected.loans.map((l) => (
                  <div key={l.id} className="border-b border-line-2 py-2.5 text-[12px]">
                    <div className="flex items-center justify-between">
                      <div>
                        <b className="block text-[10.5px] font-semibold tabular-nums">{l.loanRef}</b>
                        <span className="text-[10.5px] capitalize text-ink-muted">{l.lender.name} · {l.status}</span>
                      </div>
                      <div className="text-right">
                        <b className="block tabular-nums">{money(l.principalMinor)}</b>
                        <span className="text-[10.5px] text-ink-muted">out {money(l.outstandingMinor)}</span>
                      </div>
                    </div>
                    {l.repayments.length > 0 && (
                      <div className="mb-2 ml-2 border-l border-line pl-2 text-[10.5px] text-ink-muted">
                        {l.repayments.map((repayment) => (
                          <div key={repayment.id} className="flex justify-between py-0.5">
                            <span>{repayment.method.replaceAll('_', ' ')} · {repayment.reference ?? 'no reference'}</span>
                            <b className="tabular-nums text-accent-700">{money(repayment.amountMinor)}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-auto pt-4 text-[9.5px] leading-relaxed text-ink-muted">
              Read-only oversight. Viewing this record was audited. Borrower data
              modifications happen only through the lender relationship.
            </p>
          </aside>
        </div>
      )}

      {/* NRC photo modal — same contract as the lender's client detail page */}
      {selected && showPhoto(photoUrl) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D1426]/50 p-4 sm:p-6"
          onClick={() => setPhotoUrl(null)}>
          <div className="max-w-md rounded-card bg-white p-4 shadow-c3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <b className="text-[13px] font-bold">NRC {photoSide} photo · {selected.name}</b>
              <button onClick={() => setPhotoUrl(null)} className="text-[18px] leading-none text-ink-muted">✕</button>
            </div>
            <img src={photoUrl!} alt={`NRC ${photoSide}`}
              className="max-h-[60vh] w-full rounded-[3px] border border-line object-contain" />
            <p className="mt-2 text-[10px] text-ink-muted">This access was recorded in the audit log.</p>
          </div>
        </div>
      )}
    </div>
  );
}
