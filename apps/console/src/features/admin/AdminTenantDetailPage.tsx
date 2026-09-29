import { useCallback, useEffect, useState } from 'react';
import { FiArrowLeft, FiCheck, FiExternalLink, FiFileText, FiKey, FiX } from 'react-icons/fi';
import { Link, useParams } from 'react-router-dom';

import { Badge, ErrorBox } from '../../components/ui';
import {
  BandCardSkeleton, DataGrid, DataGridSkeleton, Drawer, Field, FormGrid,
  FormSkeleton, FormSection, ListSkeleton, PageActionBar, PageHeadSkeleton, Pill,
  Sk, StatTilesSkeleton, type Column,
} from '../../components/kit';
import { api, apiError } from '../../lib/api';
import { date, money } from '../../lib/format';

type Attachment = { id: string; kind: string; mime: string; size: number; createdAt: string };
type TenantDetail = {
  id: string; name: string; type: string; status: string;
  email: string | null; address: string | null; tpin: string | null;
  contactPerson: string | null; tagline: string | null;
  verificationNote: string | null; bozSubmittedAt: string | null; createdAt: string;
  bozFile: Attachment | null; attachments: Attachment[];
  review: { canApprove: boolean; blockers: string[]; reviewedAt: string | null; reviewer: { name: string; email: string | null } | null };
  users: Array<{ id: string; displayName: string; email: string | null; phone: string; role: string; status: string }>;
  products: Array<{ id: string; name: string; active: boolean; rateBps: number; maxTerm: number }>;
  portfolio: { clientCount: number; loanCount: number; outstandingMinor: string; overdueCount: number };
  loans: Array<{ id: string; loanRef: string; status: string; principalMinor: string; outstandingMinor: string; createdAt: string }>;
};

type OwnerNrc = { revealed: false } | { revealed: true; value: string | null };

export function AdminTenantDetailPage() {
  const { id } = useParams();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [document, setDocument] = useState<Attachment | null>(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [ownerNrc, setOwnerNrc] = useState<OwnerNrc>({ revealed: false });
  const [nrcBusy, setNrcBusy] = useState(false);
  const [mobileCode, setMobileCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const load = useCallback(() => {
    api.get<TenantDetail>(`/admin/tenants/${id}`).then((r) => setTenant(r.data)).catch((e) => setError(apiError(e)));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function review(decision: 'approve' | 'reject') {
    if (!id || (decision === 'reject' && reason.trim().length < 10)) return;
    setBusy(true); setError('');
    try {
      await api.patch(`/admin/tenants/${id}/verification`, { decision, ...(decision === 'reject' ? { reason: reason.trim() } : {}) });
      load();
    } catch (e) { setError(apiError(e)); } finally { setBusy(false); }
  }

  async function revealNrc() {
    if (!id || nrcBusy) return;
    setNrcBusy(true);
    try {
      const res = await api.get<{ ownerNrc: string | null }>(`/admin/tenants/${id}/identity`);
      setOwnerNrc({ revealed: true, value: res.data.ownerNrc });
    } catch (e) { setError(apiError(e)); }
    finally { setNrcBusy(false); }
  }

  async function viewDocument(file: Attachment) {
    setDocument(file); setDocumentUrl(''); setError('');
    try { setDocumentUrl((await api.get<{ downloadUrl: string }>(`/files/${file.id}/download-url`)).data.downloadUrl); }
    catch (e) { setDocument(null); setError(apiError(e)); }
  }

  async function generateMobileAccessCode() {
    if (!id) return;
    setGeneratingCode(true); setError('');
    try {
      const res = await api.post<{ code: string; expiresAt: string }>(`/admin/tenants/${id}/mobile-access-code`);
      setMobileCode(res.data);
    } catch (e) { setError(apiError(e)); } finally { setGeneratingCode(false); }
  }

  if (error && !tenant) return <ErrorBox message={error} />;

  // ── loading skeleton ──
  if (!tenant) {
    return (
      <div>
        <Sk w="w-32" h="h-2.5" className="mb-3" />
        <PageHeadSkeleton />
        <StatTilesSkeleton cols={4} />
        <div className="mt-3">
          <BandCardSkeleton title="w-40">
            <div className="space-y-4 p-3.5">
              <FormSkeleton fields={6} />
              <FormSkeleton fields={3} />
              <ListSkeleton rows={3} trailing pad="" />
            </div>
          </BandCardSkeleton>
        </div>
        <div className="mt-3">
          <BandCardSkeleton title="w-32">
            <DataGridSkeleton rows={4} cols={5} />
          </BandCardSkeleton>
        </div>
      </div>
    );
  }

  const loanColumns: Array<Column<TenantDetail['loans'][number]>> = [
    { key: 'ref', header: 'Loan ref', render: (loan) => <b className="text-brand-600">{loan.loanRef}</b> },
    { key: 'principal', header: 'Principal', render: (loan) => <span>{money(loan.principalMinor)}</span> },
    { key: 'outstanding', header: 'Outstanding', render: (loan) => <b>{money(loan.outstandingMinor)}</b> },
    { key: 'status', header: 'Status', render: (loan) => <Badge color={loan.status === 'overdue' ? 'red' : loan.status === 'active' ? 'green' : 'grey'} dot>{loan.status}</Badge> },
    { key: 'date', header: 'Issued', render: (loan) => <span className="text-ink-muted">{date(loan.createdAt)}</span> },
  ];

  return (
    <div>
      <Link to="/admin/queue" className="mb-3 inline-flex items-center gap-1 text-[11.5px] font-semibold text-ink-muted"><FiArrowLeft /> Review queue</Link>
      <PageActionBar title={tenant.name} sub={`${tenant.type} | registered ${date(tenant.createdAt)}`}
        actions={<Badge color={tenant.status === 'active' ? 'green' : tenant.status === 'rejected' ? 'red' : 'amber'} dot>{tenant.status.replaceAll('_', ' ')}</Badge>} />
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}

      <div className="grid gap-3 sm:grid-cols-4">
        {[['Clients', String(tenant.portfolio.clientCount)], ['Loans', String(tenant.portfolio.loanCount)], ['Outstanding', money(tenant.portfolio.outstandingMinor)], ['Overdue', String(tenant.portfolio.overdueCount)]].map(([label, value]) => (
          <div key={label} className="border border-line bg-white p-3"><div className="text-[10px] font-bold uppercase text-ink-muted">{label}</div><div className="mt-1 font-display text-[18px] font-bold">{value}</div></div>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-card border border-line bg-white">
        <FormSection title="Business information" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Business type">{tenant.type}</Field><Field label="Contact person">{tenant.contactPerson ?? 'Not provided'}</Field><Field label="Business email">{tenant.email ?? 'Not provided'}</Field>
            <Field label="TPIN">{tenant.tpin ?? 'Not provided'}</Field><Field label="Address" span={2}>{tenant.address ?? 'Not provided'}</Field>
            <Field label="Business description" span={2}>{tenant.tagline ?? 'Not provided'}</Field><Field label="Registration date">{date(tenant.createdAt)}</Field>
          </FormGrid>
        </FormSection>

        <FormSection title="Owner identity" defaultOpen>
          <FormGrid cols={3}>
            <Field label="Owner NRC">
              {ownerNrc.revealed
                ? <span className="font-mono text-[12px]">{ownerNrc.value ?? '—'}</span>
                : <button onClick={() => void revealNrc()} disabled={nrcBusy}
                    className="text-[11.5px] font-bold text-brand-600 hover:underline disabled:opacity-40">
                    {nrcBusy ? 'Loading…' : 'Reveal (access is audited)'}
                  </button>
              }
            </Field>
          </FormGrid>
        </FormSection>

        <FormSection title={`Review record | ${tenant.status.replaceAll('_', ' ')}`} defaultOpen>
          <FormGrid cols={3}>
            <Field label="Certificate submitted">{tenant.bozSubmittedAt ? date(tenant.bozSubmittedAt) : 'Not submitted'}</Field>
            <Field label="Reviewed">{tenant.review.reviewedAt ? date(tenant.review.reviewedAt) : 'Not reviewed yet'}</Field>
            <Field label="Reviewer">{tenant.review.reviewer?.name ?? 'Not assigned'}</Field>
          </FormGrid>
          {tenant.verificationNote && <div className="mt-3 border border-danger-500/25 bg-danger-50 p-3 text-[12px] text-danger-500"><b>Decision note:</b> {tenant.verificationNote}</div>}
          {!tenant.review.canApprove && <div className="mt-3 border border-amber-500/25 bg-amber-50 p-3 text-[12px] text-amber-800"><b>Approval is unavailable:</b><ul className="mt-1 list-disc pl-4">{tenant.review.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
        </FormSection>

        <FormSection title={`Verification documents (${tenant.attachments.length})`} defaultOpen>
          {tenant.attachments.length === 0 ? <p className="text-[12px] text-ink-muted">No confirmed documents have been attached.</p> : (
            <div className="divide-y divide-line-2">{tenant.attachments.map((file) => (
              <button key={file.id} onClick={() => void viewDocument(file)} className="flex w-full items-center gap-2 py-2 text-left text-[12px] hover:text-brand-600">
                <FiFileText className="shrink-0" /><span className="flex-1 font-semibold capitalize">{file.kind.replaceAll('_', ' ')}</span><span className="text-[10.5px] text-ink-muted">{file.mime.includes('pdf') ? 'PDF' : 'Image'} | {(file.size / 1024).toFixed(1)} KB</span>
              </button>
            ))}</div>
          )}
        </FormSection>

        <FormSection title={`Console users (${tenant.users.length})`} defaultOpen>
          <div className="space-y-2">{tenant.users.map((user) => <div key={user.id} className="flex justify-between border-b border-line-2 pb-2 text-[12px]"><span><b>{user.displayName}</b> | {user.email ?? user.phone}</span><span className="text-ink-muted">{user.role} | {user.status}</span></div>)}</div>
        </FormSection>
        <FormSection title="Mobile app access" defaultOpen>
          <div className="flex flex-wrap items-center gap-3"><p className="flex-1 text-[12px] text-ink-muted">Generate a one-time 10-minute app sign-in code for this lender's active owner account. Generation and redemption are audited.</p><Pill onClick={() => void generateMobileAccessCode()} disabled={generatingCode || tenant.status !== 'active'}><FiKey /> {generatingCode ? 'Creating...' : 'Generate code'}</Pill></div>
          {tenant.status !== 'active' && <p className="mt-2 text-[11px] text-amber-700">Mobile access is available after the lender is approved.</p>}
          {mobileCode && <div className="mt-3 border border-line bg-surface p-3"><div className="font-mono text-[16px] font-bold tracking-[0.08em]">{mobileCode.code}</div><p className="mt-1 text-[10.5px] text-ink-muted">Give this to the lender securely. It expires {date(mobileCode.expiresAt)} and is not stored in readable form.</p></div>}
        </FormSection>
        <FormSection title={`Loan products (${tenant.products.length})`} defaultOpen>
          <div className="space-y-2">{tenant.products.map((product) => <div key={product.id} className="flex justify-between text-[12px]"><b>{product.name}</b><span>{product.rateBps / 100}% | {product.maxTerm} months | {product.active ? 'active' : 'inactive'}</span></div>)}</div>
        </FormSection>
      </div>

      {tenant.status === 'pending_verification' && (
        <div className="mt-3 overflow-hidden rounded-card border border-line bg-white">
          <FormSection title="Review decision" defaultOpen>
            {!tenant.review.canApprove && tenant.review.blockers.length > 0 && (
              <div className="mb-3 rounded-[3px] border border-warn-500/30 bg-warn-50 p-2.5 text-[11px] text-warn-500">
                <b>Cannot approve yet — missing items:</b>
                <ul className="mt-1 list-disc pl-4">
                  {tenant.review.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-20 w-full border border-line p-2.5 text-[12px] outline-none focus:border-brand-500"
              placeholder="Required reason when rejecting this business"
            />
            <div className="mt-3 flex gap-2">
              <Pill onClick={() => review('approve')} disabled={busy || !tenant.review.canApprove}>
                <FiCheck /> Approve business
              </Pill>
              <button
                onClick={() => review('reject')}
                disabled={busy || reason.trim().length < 10}
                className="flex items-center gap-1 rounded-[3px] border border-danger-500 px-3 py-1.5 text-[11px] font-bold text-danger-500 disabled:opacity-40"
              >
                <FiX /> Reject with note
              </button>
            </div>
            {reason.trim().length > 0 && reason.trim().length < 10 && (
              <p className="mt-2 text-[11px] text-ink-muted">Rejection needs at least 10 characters.</p>
            )}
          </FormSection>
        </div>
      )}

      <div className="mt-3 overflow-hidden rounded-card border border-line bg-white"><div className="band"><span className="t">Portfolio loans</span></div><DataGrid columns={loanColumns} rows={tenant.loans} empty="No lending activity" /></div>

      <Drawer open={!!document} onClose={() => { setDocument(null); setDocumentUrl(''); }} title={document ? document.kind.replaceAll('_', ' ') : ''} sub={document ? `${document.mime} | ${date(document.createdAt)}` : undefined} width={820}>
        {!documentUrl ? <div className="h-[68vh] w-full animate-pulse rounded-[2px] bg-[#E9ECF1]" /> : <div className="space-y-3"><div className="h-[68vh] overflow-hidden border border-line bg-surface">{document?.mime === 'application/pdf' ? <iframe title="Verification document" src={documentUrl} className="h-full w-full" /> : <img src={documentUrl} alt="Verification document" className="h-full w-full object-contain" />}</div><button onClick={() => window.open(documentUrl, '_blank', 'noopener')} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-600 hover:underline"><FiExternalLink /> Open in browser</button></div>}
      </Drawer>
    </div>
  );
}
