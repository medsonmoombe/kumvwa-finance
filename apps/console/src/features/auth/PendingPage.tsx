import { useCallback, useEffect, useRef, useState } from 'react';
import { FiCheckCircle, FiClock, FiUploadCloud } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { Badge, Card, ErrorBox, Spinner } from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export function PendingPage() {
  const { tenant, refreshSession } = useAuth();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [nrc, setNrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const poll = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const submitted = tenant?.status === 'pending_verification';
  const rejected = tenant?.status === 'rejected';

  // Poll tenant status while waiting for admin review.
  useEffect(() => {
    if (!submitted || tenant?.status === 'active') return;
    poll.current = setInterval(() => void refreshSession(), 15_000);
    return () => clearInterval(poll.current);
  }, [submitted, tenant?.status, refreshSession]);

  useEffect(() => {
    if (tenant?.status === 'active') nav('/dashboard');
  }, [tenant?.status, nav]);

  const upload = useCallback(async () => {
    if (!file || !nrc.trim()) return;
    setBusy(true);
    setError('');
    try {
      const up = await api.post('/files/upload-url', {
        kind: 'boz_certificate',
        mime: file.type || 'application/pdf',
        size: file.size,
      });
      await fetch(up.data.uploadUrl as string, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      });
      await api.post(`/files/${up.data.fileId}/confirm`);
      await api.post('/tenants/me/verification', {
        fileId: up.data.fileId,
        ownerNrc: nrc,
      });
      await refreshSession();
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }, [file, nrc, refreshSession]);

  if (!tenant) return null;

  return (
    <div className="mx-auto max-w-lg py-14">
      <h1 className="font-display text-[22px] font-bold tracking-tight">
        Business verification
      </h1>
      <p className="mt-1 text-[13px] text-ink-muted">{tenant.name}</p>

      <Card className="mt-6 p-6">
        {!submitted ? (
          <div className="space-y-4">
            {rejected && tenant.verificationNote && (
              <div className="rounded-xl border border-danger-500/25 bg-danger-50 p-3.5 text-[12.5px] text-danger-500">
                <b>Changes requested by the reviewer:</b> {tenant.verificationNote}
                <p className="mt-1 text-[11.5px]">Upload a corrected certificate and submit again for review.</p>
              </div>
            )}
            <p className="text-[13px] leading-relaxed text-ink-2">
              {rejected ? 'Replace the document and resubmit your' : 'Upload your'}{' '}
              <b>Bank of Zambia registration certificate</b> to activate lending.
            </p>
            <label className="flex cursor-pointer flex-col items-center rounded-card border-[1.5px] border-dashed border-brand-100 bg-brand-50 px-4 py-8 text-center hover:border-brand-500">
              <FiUploadCloud size={26} className="text-brand-500" />
              <b className="mt-2 text-[13px] text-ink">
                Click to upload certificate
              </b>
              <span className="mt-0.5 text-[11px] text-ink-muted">
                PDF or JPG · max 5MB
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <div className="flex items-center gap-2.5 rounded-xl border-[1.5px] border-accent-500 px-3.5 py-2.5 text-[12.5px] font-semibold">
                <FiCheckCircle className="text-accent-700" /> {file.name}
              </div>
            )}
            <input
              className="w-full rounded-input border-[1.5px] border-line px-4 py-3 text-[14px] outline-none focus:border-brand-500"
              value={nrc}
              onChange={(e) => setNrc(e.target.value)}
              placeholder="Owner NRC — e.g. 245711/63/1"
            />
            {error && <ErrorBox message={error} />}
            <button
              disabled={busy || !file || !nrc}
              onClick={upload}
              className="flex h-[50px] w-full items-center justify-center rounded-btn bg-brand-600 font-bold text-white shadow-c1 hover:bg-brand-900 disabled:opacity-40"
            >
              {busy ? <Spinner className="border-white" /> : rejected ? 'Resubmit for Review' : 'Submit for Verification'}
            </button>
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warn-50 text-warn-500">
              <FiClock size={26} />
            </div>
            <div className="mt-4 font-display text-[16px] font-bold">
              Submitted — under review
            </div>
            <p className="mx-auto mt-2 max-w-sm text-[12.5px] leading-relaxed text-ink-muted">
              Our team is reviewing your BOZ certificate. This page updates
              automatically once approved.
            </p>
            {tenant.verificationNote && (
              <div className="mx-auto mt-4 max-w-sm rounded-xl bg-warn-50 p-3.5 text-left text-[12.5px] text-warn-500">
                <b>Reviewer note:</b> {tenant.verificationNote}
              </div>
            )}
            <div className="mt-5 flex justify-center">
              <Spinner />
            </div>
          </div>
        )}
      </Card>

      <div className="mt-4 flex justify-center">
        <Badge color={tenant.status === 'rejected' ? 'red' : 'amber'}>
          {tenant.status.replaceAll('_', ' ')}
        </Badge>
      </div>
    </div>
  );
}
