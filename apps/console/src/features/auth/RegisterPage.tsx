import { useEffect, useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiEye, FiEyeOff, FiUploadCloud } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { AuthLayout, AuthStepper } from '../../components/kit';
import { ErrorBox } from '../../components/ui';
import { api, apiError, setTokens } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { NRC_RE, formatNrc, nrcError } from '../../lib/nrc';
import {
  MAX_UPLOAD_MB,
  assertUploadable,
  uploadErrorMessage,
  uploadFile,
} from '../../lib/upload';

const inp =
  'w-full h-8 rounded-[3px] border border-[#D9DDE3] px-2.5 text-[12.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#A6ADC0] focus:border-[#1A4FBF] focus:shadow-[0_0_0_2px_rgba(26,79,191,0.12)]';
const lbl = 'mb-1 block text-[10.5px] font-semibold text-[#555]';
const btn =
  'flex w-full items-center justify-center gap-1.5 h-9 rounded-[3px] bg-[#1A4FBF] text-[11.5px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-[#12378F] disabled:opacity-40';
const bad = ' border-[#C62828] focus:border-[#C62828] focus:shadow-[0_0_0_2px_rgba(198,40,40,0.12)]';

/** Mirrors the API's `normalizeZmPhone`: Zambian mobile = 0 + 5-9 + 8 digits. */
function isZmPhone(v: string): boolean {
  return /^0[5-9]\d{8}$/.test(v.replace(/[\s\-()]/g, ''));
}

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

/** Everything still blocking the current step, named so nothing is a mystery. */
function MissingList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3 rounded-[3px] border border-[#F0C6C6] bg-[#FDECEC] px-3 py-2">
      <b className="block text-[9.5px] font-extrabold uppercase tracking-wide text-[#C62828]">
        {items.length === 1 ? '1 item still needed' : `${items.length} items still needed`}
      </b>
      <ul className="mt-1 list-disc pl-4 text-[10.5px] leading-[1.6] text-[#C62828]">
        {items.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  if (!message) return null;
  return <p className="mt-1 text-[10px] font-semibold text-[#C62828]">{message}</p>;
}

type Step = 1 | 2 | 3;

const BANNERS: Record<Step, { heading: React.ReactNode; sub: string; footerLabel: string; footerBody: string }> = {
  1: {
    heading: <>Three steps.<br /><em className="not-italic text-[#7FE8AC]">Five minutes.</em></>,
    sub: 'Register your business for platform review. Most businesses are approved within two working days.',
    footerLabel: 'Before you start',
    footerBody: 'Have your TPIN and the contact person\'s NRC ready.',
  },
  2: {
    heading: <>Your account,<br /><em className="not-italic text-[#7FE8AC]">your credentials.</em></>,
    sub: 'Set the email and password you will use to sign in to this console every day.',
    footerLabel: 'One address, one business',
    footerBody: 'Each console account maps to exactly one verified email address.',
  },
  3: {
    heading: <>The last step:<br /><em className="not-italic text-[#7FE8AC]">your identity.</em></>,
    sub: 'Confirm the responsible contact person. A BOZ certificate is optional supporting documentation.',
    footerLabel: 'What happens next',
    footerBody: "Review takes 1–2 working days. You'll get a notification the moment you're approved.",
  },
};

const FOOTERS: Record<Step, string> = {
  1: 'Step 1 of 3',
  2: 'Step 2 of 3',
  3: 'Step 3 of 3 · acceptance is audited',
};

export function RegisterPage() {
  const { refreshSession } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // step 1 — the lending business
  const [rName, setRName] = useState('');
  const [rType, setRType] = useState('sacco');
  const [rContact, setRContact] = useState('');
  const [rDescription, setRDescription] = useState('');
  const [rPhone, setRPhone] = useState('');
  const [rAddress, setRAddress] = useState('');
  const [rTpin, setRTpin] = useState('');

  // step 2 — console credentials
  const [rEmail, setREmail] = useState('');
  const [rPassword, setRPassword] = useState('');
  const [rConfirm, setRConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  // step 3 — BOZ certificate + owner NRC + terms
  const [rFile, setRFile] = useState<File | null>(null);
  const [rFileError, setRFileError] = useState('');
  const [rNrc, setRNrc] = useState('');
  const [rAgreed, setRAgreed] = useState(false);
  const [terms, setTerms] = useState<{ version: number; body: string } | null>(null);
  const [termsRetry, setTermsRetry] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (step === 3) {
      setTerms(null);
      api.get('/terms/platform')
        .then((r) => setTerms(r.data as { version: number; body: string }))
        .catch(() => {});
    }
  }, [step, termsRetry]);

  const emailOk = isValidEmail(rEmail);
  const phoneOk = isZmPhone(rPhone);
  const nrcOk = NRC_RE.test(rNrc);

  /** Inline errors appear only once a field has been visited or submitted. */
  const show = (key: string) => touched[key] === true;

  /** Named gaps per step — the button is gated on exactly this list. */
  const missing: Record<Step, string[]> = {
    1: [
      ...(rName.trim() ? [] : ['Business name']),
      ...(rType ? [] : ['Business type']),
      ...(rContact.trim() ? [] : ['Contact person']),
      ...(rDescription.trim().length >= 20
        ? []
        : ['Business description (at least 20 characters)']),
      ...(rTpin.trim() ? [] : ['TPIN']),
      ...(!rPhone
        ? ['Phone number']
        : phoneOk
          ? []
          : ['A valid Zambian mobile number, e.g. 0971234567']),
    ],
    2: [
      ...(emailOk ? [] : ['A valid work email address']),
      ...(rPassword.length >= 8 ? [] : ['A password of at least 8 characters']),
      ...(rConfirm && rConfirm === rPassword
        ? []
        : ['Both password fields must match']),
    ],
    3: [
      ...(!rNrc
        ? ['Owner NRC']
        : nrcOk
          ? []
          : ['Owner NRC in the form 245711/63/1']),
      ...(rAgreed ? [] : ['Accept the Platform Terms']),
      ...(terms ? [] : ['Platform Terms still loading — retry below']),
    ],
  };

  function next(s: Step) { setError(''); setStep(s); }

  async function submit() {
    setTouched((t) => ({ ...t, file: true, nrc: true, agreed: true }));
    // The button is disabled while anything is missing; this is the belt to its braces.
    if (missing[3].length > 0) return;
    setBusy(true); setError('');
    try {
      const reg = await api.post('/auth/register/tenant', {
        phone: rPhone,
        password: rPassword,
        email: rEmail.trim(),
        businessName: rName.trim(),
        businessType: rType,
        contactPerson: rContact.trim(),
        businessDescription: rDescription.trim(),
        address: rAddress.trim() || undefined,
        tpin: rTpin.trim(),
        ownerNrc: rNrc,
        acceptedTermsVersion: terms?.version,
      });
      const d = reg.data as { accessToken: string; refreshToken: string };
      setTokens(d.accessToken, d.refreshToken);

      // The account exists now, so the certificate can finally be attached:
      // presign → PUT → confirm → submit for review, all with the new token.
      let notice = '';
      if (rFile) {
        try {
          const fileId = await uploadFile(rFile, 'boz_certificate');
          await api.post('/tenants/me/verification', { fileId, ownerNrc: rNrc });
        } catch (e) {
          notice =
            `Your business account was created, but the optional BOZ certificate was not attached: ` +
            `${uploadErrorMessage(e)} You can add it later from the verification screen.`;
        }
      }

      await refreshSession();
      nav('/verify', { state: notice ? { notice } : undefined });
    } catch (e) { setError(apiError(e)); setBusy(false); }
  }

  return (
    <AuthLayout banner={BANNERS[step]} footer={FOOTERS[step]}>
      {error && <div className="mt-5 mb-0"><ErrorBox message={error} /></div>}

      {/* ══ STEP 1 — Business ══ */}
      {step === 1 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Business details</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#888]">Tell us who is lending</p>
          <AuthStepper steps={['Business', 'Account', 'Identity']} current={0} />

          <div className="mb-3">
            <label className={lbl}>Business name <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} value={rName} onChange={(e) => setRName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))} placeholder="Chilenje Community SACCO" />
            <FieldError message={show('name') && !rName.trim() ? 'Enter the registered business name' : ''} />
          </div>
          <div className="mb-3">
            <label className={lbl}>Business type <em className="not-italic text-[#C62828]">*</em></label>
            <select className={inp} value={rType} onChange={(e) => setRType(e.target.value)}>
              <option value="sacco">SACCO / Cooperative</option>
              <option value="mfi">Microfinance Institution</option>
              <option value="individual_lender">Individual Lender</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="mb-3">
            <label className={lbl}>Contact person <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} value={rContact} onChange={(e) => setRContact(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, contact: true }))} placeholder="Full name" />
            <FieldError message={show('contact') && !rContact.trim() ? 'The person we contact about this business' : ''} />
          </div>
          <div className="mb-3">
            <label className={lbl}>Business description <em className="not-italic text-[#C62828]">*</em></label>
            <textarea
              className={[inp, 'h-16 resize-y py-2'].join(' ')}
              value={rDescription}
              onChange={(e) => setRDescription(e.target.value.slice(0, 1000))}
              onBlur={() => setTouched((t) => ({ ...t, description: true }))}
              placeholder="Describe your lending business, clients served, and loan products."
            />
            <FieldError message={show('description') && rDescription.trim().length < 20 ? 'Enter at least 20 characters about the business' : ''} />
          </div>
          <div className="mb-3">
            <label className={lbl}>Phone number <em className="not-italic text-[#C62828]">*</em></label>
            <input className={`${inp} tabular-nums${show('phone') && !phoneOk ? bad : ''}`} type="tel" inputMode="numeric"
              value={rPhone} onChange={(e) => setRPhone(e.target.value.replace(/[\s\-()]/g, ''))}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))} placeholder="0971234567" />
            <FieldError message={show('phone') && !phoneOk ? 'Enter a Zambian mobile number, e.g. 0971234567' : ''} />
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className={lbl}>TPIN <em className="not-italic text-[#C62828]">*</em></label>
              <input className={`${inp} tabular-nums`} value={rTpin}
                onChange={(e) => setRTpin(e.target.value.replace(/[^\dA-Za-z]/g, '').slice(0, 20))}
                placeholder="1000123456" />
            </div>
            <div>
              <label className={lbl}>Physical address <span className="font-normal text-[#A6ADC0]">optional</span></label>
              <input className={inp} value={rAddress} onChange={(e) => setRAddress(e.target.value)}
                placeholder="Plot 7, Lusaka" />
            </div>
          </div>

          <MissingList items={missing[1]} />
          <button className={btn} disabled={missing[1].length > 0} onClick={() => next(2)}>
            Continue <FiArrowRight size={13} />
          </button>
          <p className="mt-4 text-center text-[11.5px] text-[#888]">
            Already registered?{' '}
            <b className="cursor-pointer text-[#1A4FBF]" onClick={() => nav('/login')}>Log in</b>
          </p>
        </>
      )}

      {/* ══ STEP 2 — Account ══ */}
      {step === 2 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Your account</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#888]">How you sign in to this console</p>
          <AuthStepper steps={['Business', 'Account', 'BOZ upload']} current={1} />

          <div className="mb-3">
            <label className={lbl}>Work email <em className="not-italic text-[#C62828]">*</em></label>
            <input className={`${inp}${show('email') && !emailOk ? bad : ''}`} type="email" value={rEmail}
              onChange={(e) => setREmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              placeholder="info@yourbusiness.zm" autoComplete="email" />
            <FieldError message={show('email') && !emailOk ? 'Enter a valid email address, e.g. info@yourbusiness.zm' : ''} />
          </div>
          <div className="mb-3">
            <label className={lbl}>Password <em className="not-italic text-[#C62828]">*</em></label>
            <div className="relative">
              <input className={inp} type={showPw ? 'text' : 'password'} value={rPassword}
                onChange={(e) => setRPassword(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                placeholder="Min 8 characters" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888]">
                {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              </button>
            </div>
            <FieldError message={show('password') && rPassword.length < 8 ? 'Use at least 8 characters' : ''} />
          </div>
          <div className="mb-4">
            <label className={lbl}>Confirm password <em className="not-italic text-[#C62828]">*</em></label>
            <input className={`${inp}${show('confirm') && rConfirm !== rPassword ? bad : ''}`}
              type={showPw ? 'text' : 'password'} value={rConfirm}
              onChange={(e) => setRConfirm(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
              placeholder="Repeat password" autoComplete="new-password" />
            <FieldError message={show('confirm') && rConfirm !== rPassword ? 'Passwords do not match' : ''} />
          </div>

          <MissingList items={missing[2]} />
          <button className={btn} disabled={missing[2].length > 0} onClick={() => next(3)}>
            Continue <FiArrowRight size={13} />
          </button>
          <p className="mt-3 text-center text-[11px] text-[#888]">
            <b className="inline-flex cursor-pointer items-center gap-1 text-[#1A4FBF]" onClick={() => next(1)}>
              <FiArrowLeft size={11} /> Back
            </b>
          </p>
        </>
      )}

      {/* ══ STEP 3 — contact identity and optional evidence ══ */}
      {step === 3 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Contact identity</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#888]">Confirm the responsible contact person</p>
          <AuthStepper steps={['Business', 'Account', 'Identity']} current={2} />

          <label className={`mb-3 flex cursor-pointer flex-col items-center rounded-[3px] border-[1.5px] border-dashed px-4 py-3.5 text-center hover:border-[#1A4FBF] ${
            rFile
              ? 'border-[#2E7D32] bg-[#EAF7EF]'
              : show('file') && !rFile
                ? 'border-[#C62828] bg-[#FDECEC]'
                : 'border-[#B9C6E8] bg-[#EDF3FE]'
          }`}>
            {rFile
              ? <>
                  <b className="block text-[11.5px] text-[#2E7D32]">✓ {rFile.name}</b>
                  <span className="mt-0.5 text-[9.5px] text-[#555]">
                    {(rFile.size / 1024).toFixed(0)} KB · click to attach a different file
                  </span>
                </>
              : <>
                  <FiUploadCloud size={20} className="text-[#1A4FBF]" />
                  <b className="mt-1 block text-[11.5px] text-ink">Attach BOZ registration certificate <span className="font-normal text-[#888]">(optional)</span></b>
                  <span className="text-[9.5px] text-[#888]">PDF, JPG or PNG · max {MAX_UPLOAD_MB}MB</span>
                </>}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setRFileError('');
                if (!picked) { setRFile(null); return; }
                // Refuse the wrong size/type here, before it reaches storage.
                try { assertUploadable(picked); setRFile(picked); }
                catch (err) { setRFile(null); setRFileError(uploadErrorMessage(err)); }
                setTouched((t) => ({ ...t, file: true }));
              }} />
          </label>
          <FieldError message={rFileError} />

          <div className="mb-3">
            <label className={lbl}>Owner NRC <em className="not-italic text-[#C62828]">*</em></label>
            <input className={`${inp} tabular-nums${show('nrc') && !nrcOk ? bad : ''}`} value={rNrc}
              inputMode="numeric"
              onChange={(e) => setRNrc(formatNrc(e.target.value))}
              onBlur={() => setTouched((t) => ({ ...t, nrc: true }))}
              placeholder="245711/63/1" />
            <FieldError message={show('nrc') ? nrcError(rNrc) : ''} />
            <p className="mt-1 text-[9.5px] text-[#888]">Required for the person responsible for this business.</p>
          </div>

          <div className="relative mb-2 max-h-[110px] overflow-hidden rounded-[3px] border border-[#D9DDE3] bg-[#F5F6F8] p-3">
            <p className="whitespace-pre-wrap text-[10px] leading-[1.65] text-[#555]">
              {terms?.body ?? 'Loading platform terms…'}
            </p>
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#F5F6F8] to-transparent" />
          </div>
          <div className="mb-3 flex justify-end gap-3">
            <span className="cursor-pointer text-[10px] font-bold text-[#1A4FBF]"
              onClick={() => setTermsRetry((n) => n + 1)}>
              {terms ? 'Read full terms' : 'Retry loading'}
            </span>
            <span className="cursor-pointer text-[10px] font-bold text-[#1A4FBF]"
              onClick={() => window.open(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api/v1'}/terms/platform/pdf`, '_blank')}>
              Download PDF
            </span>
          </div>

          <label className="mb-1 flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={rAgreed}
              onChange={(e) => { setRAgreed(e.target.checked); setTouched((t) => ({ ...t, agreed: true })); }}
              className="mt-0.5 accent-[#1A4FBF]" />
            <span className="text-[10.5px] leading-[1.5] text-[#555]">
              I have read and accept the Platform Terms. Kumvwa provides software only and is not liable for lending decisions or client repayment.
            </span>
          </label>
          <FieldError message={show('agreed') && !rAgreed ? 'Acceptance is required before submitting' : ''} />

          <MissingList items={missing[3]} />
          <button className={btn} disabled={busy || missing[3].length > 0} onClick={submit}>
            {busy ? 'Registering…' : 'Submit for Verification'}{' '}
            {!busy && <FiArrowRight size={13} />}
          </button>
          <p className="mt-3 text-center text-[11px] text-[#888]">
            <b className="inline-flex cursor-pointer items-center gap-1 text-[#1A4FBF]" onClick={() => next(2)}>
              <FiArrowLeft size={11} /> Back
            </b>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
