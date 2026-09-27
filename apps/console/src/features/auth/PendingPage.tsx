import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiCheckCircle,
  FiClock,
  FiExternalLink,
  FiFileText,
  FiRefreshCw,
  FiUploadCloud,
  FiXCircle,
} from 'react-icons/fi';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  Field,
  FormGrid,
  FormSection,
  PageActionBar,
  Pill,
} from '../../components/kit';
import { Badge, ErrorBox, inputCls } from '../../components/ui';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date } from '../../lib/format';
import { formatNrc, nrcError } from '../../lib/nrc';
import {
  MAX_UPLOAD_MB,
  assertUploadable,
  uploadErrorMessage,
  uploadFile,
} from '../../lib/upload';

type StepState = 'done' | 'current' | 'todo';

/** One row of the application journey — the same order the reviewer works in. */
function StageRow({ label, state, detail }: { label: string; state: StepState; detail?: string }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-line-2 py-2 last:border-b-0">
      <span className="mt-0.5">
        {state === 'done' ? (
          <FiCheckCircle className="text-accent-700" size={14} />
        ) : state === 'current' ? (
          <FiClock className="text-warn-500" size={14} />
        ) : (
          <FiXCircle className="text-ink-muted" size={14} />
        )}
      </span>
      <div className="flex-1">
        <b className={`block text-[12px] ${state === 'todo' ? 'text-ink-muted' : 'text-ink'}`}>{label}</b>
        {detail && <span className="text-[10.5px] text-ink-muted">{detail}</span>}
      </div>
    </div>
  );
}

interface UploadFormProps {
  status: string;
  file: File | null;
  fileError: string;
  nrc: string;
  busy: boolean;
  missing: string[];
  touched: Record<string, boolean>;
  onPickFile: (f: File | null, err: string) => void;
  onChangeNrc: (v: string) => void;
  onBlurField: (k: string) => void;
  onSubmit: () => void;
}

function PendingUploadForm({
  status,
  file,
  fileError,
  nrc,
  busy,
  missing,
  touched,
  onPickFile,
  onChangeNrc,
  onBlurField,
  onSubmit,
}: UploadFormProps) {
  const showFile = touched['file'] && !file;
  return (
    <div className="mb-3 overflow-hidden rounded-card border border-line bg-white shadow-c1">
      <div className="band">
        <span className="t">
          {status === 'rejected' ? 'Resubmit for review' : 'Submit BOZ certificate'}
        </span>
      </div>
      <div className="p-3.5">
        <p className="text-[12.5px] leading-relaxed text-ink-2">
          Upload your <b>Bank of Zambia registration certificate</b> and owner NRC to activate lending.
        </p>

        <label
          className={`mt-3 flex cursor-pointer flex-col items-center rounded-[3px] border-[1.5px] border-dashed px-4 py-6 text-center ${
            file
              ? 'border-accent-500 bg-accent-50'
              : showFile
                ? 'border-danger-500 bg-danger-50'
                : 'border-brand-100 bg-brand-50 hover:border-brand-500'
          }`}
        >
          <FiUploadCloud size={22} className="text-brand-500" />
          {file ? (
            <>
              <b className="mt-2 text-[12.5px] text-accent-700">✓ {file.name}</b>
              <span className="mt-0.5 text-[10.5px] text-ink-muted">
                {(file.size / 1024).toFixed(0)} KB · click to choose a different file
              </span>
            </>
          ) : (
            <>
              <b className="mt-2 text-[12.5px] text-ink">Click to attach certificate</b>
              <span className="mt-0.5 text-[10.5px] text-ink-muted">PDF, JPG or PNG · max {MAX_UPLOAD_MB} MB</span>
            </>
          )}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              if (!picked) { onPickFile(null, ''); return; }
              try {
                assertUploadable(picked);
                onPickFile(picked, '');
              } catch (err) {
                onPickFile(null, uploadErrorMessage(err));
              }
            }}
          />
        </label>
        {fileError && <p className="mt-1 text-[11px] font-semibold text-danger-500">{fileError}</p>}

        <div className="mt-3">
          <FormGrid cols={2}>
            <Field label="Owner NRC" required>
              <input
                className={inputCls}
                value={nrc}
                inputMode="numeric"
                onChange={(e) => onChangeNrc(formatNrc(e.target.value))}
                onBlur={() => onBlurField('nrc')}
                placeholder="245711/63/1"
              />
            </Field>
            <Field label="Verification requirement">
              <p className="pt-1.5 text-[11px] leading-relaxed text-ink-muted">
                Must match the identity details on the certificate.
              </p>
            </Field>
          </FormGrid>
          {touched['nrc'] && nrcError(nrc) && (
            <p className="mt-1 text-[11px] font-semibold text-danger-500">{nrcError(nrc)}</p>
          )}
        </div>

        {missing.length > 0 && (
          <div className="mt-3 rounded-[3px] border border-warn-500/30 bg-warn-50 px-3 py-2 text-[11.5px] text-warn-500">
            <b>Still needed before you can submit:</b>
            <ul className="mt-1 list-disc pl-4">
              {missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Pill onClick={onSubmit} disabled={busy || missing.length > 0}>
            <FiUploadCloud size={12} />
            {busy ? 'Submitting…' : status === 'rejected' ? 'Resubmit for review' : 'Submit for review'}
          </Pill>
          <span className="text-[10.5px] text-ink-muted">All documents are audited upon review.</span>
        </div>
      </div>
    </div>
  );
}

function PendingProgressCard({
  tenant,
  status,
  needsSubmission,
  underReview,
}: {
  tenant: NonNullable<ReturnType<typeof useAuth>['tenant']>;
  status: string;
  needsSubmission: boolean;
  underReview: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white shadow-c1">
      <FormSection title="Application progress" defaultOpen>
        <StageRow label="Business registered" state="done" detail={`Created ${date(tenant.createdAt)}`} />
        <StageRow
          label="BOZ certificate submitted"
          state={tenant.bozSubmittedAt ? 'done' : needsSubmission ? 'current' : 'todo'}
          detail={tenant.bozSubmittedAt ? `Submitted ${date(tenant.bozSubmittedAt)}` : 'Awaiting certificate & NRC'}
        />
        <StageRow
          label="Review decision"
          state={status === 'active' ? 'done' : status === 'rejected' ? 'current' : underReview ? 'current' : 'todo'}
          detail={status === 'rejected' ? 'Resubmission needed' : underReview ? 'In review queue' : undefined}
        />
      </FormSection>

      <FormSection title="Your application details" defaultOpen>
        <FormGrid cols={3}>
          <Field label="Business name">{tenant.name}</Field>
          <Field label="Business type">{tenant.type}</Field>
          <Field label="Status">{status.replaceAll('_', ' ')}</Field>
          <Field label="Certificate on file">
            {tenant.bozFile ? `Attached · ${(tenant.bozFile.size / 1024).toFixed(0)} KB` : 'None'}
          </Field>
          <Field label="Submitted">{tenant.bozSubmittedAt ? date(tenant.bozSubmittedAt) : 'Not yet'}</Field>
          <Field label="Registered">{date(tenant.createdAt)}</Field>
        </FormGrid>
      </FormSection>
    </div>
  );
}


/**
 * The BOZ gate. A rejected application is resubmitted from here, so this page
 * owns the certificate upload for both the first submission and every retry —
 * and every failure names the step that failed and why.
 */
export function PendingPage() {
  const { tenant, refreshSession } = useAuth();
  const location = useLocation();
  const nav = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [nrc, setNrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  // A certificate that could not be attached during sign-up arrives here with
  // its reason, so the owner is not left guessing why the wizard ended early.
  const [notice] = useState(
    () => (location.state as { notice?: string } | null)?.notice ?? '',
  );
  const poll = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const status = tenant?.status ?? 'pending_verification';
  const submitted = status === 'pending_verification';
  const underReview = submitted && Boolean(tenant?.bozFile);
  const needsSubmission =
    status === 'rejected' || (submitted && !tenant?.bozFile);

  // Poll while the review is open so approval lands without a manual refresh.
  useEffect(() => {
    if (!submitted) return;
    poll.current = setInterval(() => void refreshSession(), 15_000);
    return () => clearInterval(poll.current);
  }, [submitted, refreshSession]);

  useEffect(() => {
    if (status === 'active') nav('/dashboard');
  }, [status, nav]);

  const refreshNow = useCallback(async () => {
    setRefreshing(true);
    await refreshSession();
    setRefreshing(false);
  }, [refreshSession]);

  /** Opens the owner's own certificate via a short-lived presigned URL. */
  const viewCertificate = useCallback(async () => {
    if (!tenant?.bozFile) return;
    setViewing(true);
    setError('');
    try {
      const res = await api.get<{ downloadUrl: string }>(
        `/files/${tenant.bozFile.id}/download-url`,
      );
      window.open(res.data.downloadUrl, '_blank', 'noopener');
    } catch (e) {
      setError(`Could not open the certificate: ${apiError(e)}`);
    } finally {
      setViewing(false);
    }
  }, [tenant?.bozFile]);

  const submit = useCallback(async () => {
    setTouched((t) => ({ ...t, file: true, nrc: true }));
    if (!file || fileError || nrcError(nrc)) return;
    setBusy(true);
    setError('');
    setFlash('');

    // Step 1 — storage. Its failures are network/credentials, not validation.
    let fileId = '';
    try {
      fileId = await uploadFile(file, 'boz_certificate');
    } catch (e) {
      setError(`Upload failed: ${apiError(e)}`);
      setBusy(false);
      return;
    }

    // Step 2 — hand the confirmed document to the review queue.
    try {
      await api.post('/tenants/me/verification', { fileId, ownerNrc: nrc });
    } catch (e) {
      setError(`Could not submit the certificate for review: ${apiError(e)}`);
      setBusy(false);
      return;
    }

    await refreshSession();
    setFile(null);
    setNrc('');
    setFlash(
      'Certificate submitted successfully — our team will review it and this page updates automatically.',
    );
    setBusy(false);
  }, [file, fileError, nrc, refreshSession]);

  const missing: string[] = [
    ...(file ? [] : ['Attach the Bank of Zambia registration certificate']),
    ...(nrcError(nrc) ? [nrcError(nrc)] : []),
  ];

  if (!tenant) return null;

  const badgeColor =
    status === 'active'
      ? 'green'
      : status === 'rejected' || status === 'suspended'
        ? 'red'
        : 'amber';

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageActionBar
        title="Business verification"
        sub={`${tenant.name} · ${tenant.type} · registered ${date(tenant.createdAt)}`}
        actions={
          <>
            <Badge color={badgeColor} dot>
              {status.replaceAll('_', ' ')}
            </Badge>
            <Pill tone="ghost" onClick={() => void refreshNow()} disabled={refreshing}>
              <FiRefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh status
            </Pill>
          </>
        }
      />

      {notice && <div className="mb-3"><ErrorBox message={notice} /></div>}
      {error && <div className="mb-3"><ErrorBox message={error} /></div>}
      {flash && (
        <div className="mb-3 flex items-center gap-2 rounded-[3px] border border-accent-500/30 bg-accent-50 px-3.5 py-2.5 text-[12px] font-semibold text-accent-700">
          <FiCheckCircle size={13} /> {flash}
        </div>
      )}

      {/* ── rejected reason banner ── */}
      {status === 'rejected' && (
        <div className="mb-3 overflow-hidden rounded-card border border-danger-500/30 bg-white shadow-c1">
          <div className="band"><span className="t">Changes requested by reviewer</span></div>
          <div className="p-3.5 text-[12.5px] leading-relaxed text-ink-2">
            {tenant.verificationNote ?? 'The submitted certificate was not accepted. Please upload a corrected copy.'}
            <p className="mt-2 text-[11px] text-ink-muted">
              Replace the certificate and NRC below to resubmit.
            </p>
          </div>
        </div>
      )}

      {/* ── under review card ── */}
      {underReview && (
        <div className="mb-3 overflow-hidden rounded-card border border-line bg-white shadow-c1">
          <div className="band">
            <span className="t">Under review</span>
            <span className="ml-auto text-[10px] font-bold text-ink-muted">
              submitted {tenant.bozSubmittedAt ? date(tenant.bozSubmittedAt) : '—'}
            </span>
          </div>
          <div className="p-3.5">
            <div className="flex items-center gap-2 text-[12.5px]">
              <FiClock className="text-warn-500" size={14} />
              <b>Our team is reviewing your BOZ certificate.</b>
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              Review typically takes 1–2 working days. This page updates automatically upon approval.
            </p>
            {tenant.bozFile && (
              <div className="mt-3 flex items-center gap-2 border-t border-line-2 pt-3 text-[12px]">
                <FiFileText className="text-ink-muted" size={13} />
                <span className="flex-1 font-semibold">BOZ certificate</span>
                <span className="text-[10.5px] text-ink-muted">
                  {(tenant.bozFile.size / 1024).toFixed(0)} KB · {date(tenant.bozFile.createdAt)}
                </span>
                <button
                  onClick={() => void viewCertificate()}
                  disabled={viewing}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 hover:underline disabled:opacity-40"
                >
                  <FiExternalLink size={11} /> {viewing ? 'Opening…' : 'View'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── upload/resubmit form ── */}
      {needsSubmission && (
        <PendingUploadForm
          status={status}
          file={file}
          fileError={fileError}
          nrc={nrc}
          busy={busy}
          missing={missing}
          touched={touched}
          onPickFile={(f, err) => {
            setFile(f);
            setFileError(err);
            setTouched((t) => ({ ...t, file: true }));
          }}
          onChangeNrc={(v) => setNrc(v)}
          onBlurField={(k) => setTouched((t) => ({ ...t, [k]: true }))}
          onSubmit={() => void submit()}
        />
      )}

      {/* ── suspended ── */}
      {status === 'suspended' && (
        <div className="mb-3 overflow-hidden rounded-card border border-line bg-white shadow-c1">
          <div className="band"><span className="t">Account suspended</span></div>
          <div className="p-3.5 text-[12.5px] leading-relaxed text-ink-2">
            This business cannot be verified while suspended. Contact Kumvwa support.
          </div>
        </div>
      )}

      {/* ── journey + details ── */}
      <PendingProgressCard
        tenant={tenant}
        status={status}
        needsSubmission={needsSubmission}
        underReview={underReview}
      />

      <p className="mt-3 text-[10.5px] text-ink-muted">
        Kumvwa provides software only and is not liable for lending decisions or client repayment.
      </p>
    </div>
  );
}
