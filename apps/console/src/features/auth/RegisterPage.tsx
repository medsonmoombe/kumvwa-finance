import { useEffect, useState } from 'react';
import { FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { AuthLayout, AuthStepper } from '../../components/kit';
import { ErrorBox } from '../../components/ui';
import { api, apiError, setTokens } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const inp =
  'w-full h-8 rounded-[3px] border border-[#D9DDE3] px-2.5 text-[12.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#A6ADC0] focus:border-[#1A4FBF] focus:shadow-[0_0_0_2px_rgba(26,79,191,0.12)]';
const lbl = 'mb-1 block text-[10.5px] font-semibold text-[#555]';
const btn =
  'flex w-full items-center justify-center gap-1.5 h-9 rounded-[3px] bg-[#1A4FBF] text-[11.5px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-[#12378F] disabled:opacity-40';

type Step = 1 | 2 | 3;

const BANNERS: Record<Step, { heading: React.ReactNode; sub: string; footerLabel: string; footerBody: string }> = {
  1: {
    heading: <>Three steps.<br /><em className="not-italic text-[#7FE8AC]">Five minutes.</em></>,
    sub: 'Register your business and upload your Bank of Zambia certificate. Most businesses are approved within two working days.',
    footerLabel: 'Before you start',
    footerBody: 'Have your BOZ registration certificate ready as a PDF or photo.',
  },
  2: {
    heading: <>Your account,<br /><em className="not-italic text-[#7FE8AC]">your credentials.</em></>,
    sub: 'Set the email and password you will use to sign in to this console every day.',
    footerLabel: 'One address, one business',
    footerBody: 'Each console account maps to exactly one verified email address.',
  },
  3: {
    heading: <>The last gate:<br /><em className="not-italic text-[#7FE8AC]">your license.</em></>,
    sub: "Upload your Bank of Zambia registration certificate. Our team reviews it, and your account goes live the moment it's approved.",
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

  // step 1
  const [rName, setRName] = useState('');
  const [rType, setRType] = useState('sacco');
  const [rContact, setRContact] = useState('');
  const [rPhone, setRPhone] = useState('');

  // step 2
  const [rEmail, setREmail] = useState('');
  const [rPassword, setRPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  // step 3
  const [rFile, setRFile] = useState<File | null>(null);
  const [rNrc, setRNrc] = useState('');
  const [rAgreed, setRAgreed] = useState(false);
  const [terms, setTerms] = useState<{ version: number; body: string } | null>(null);
  const [termsRetry, setTermsRetry] = useState(0);

  useEffect(() => {
    if (step === 3) {
      setTerms(null);
      api.get('/terms/platform')
        .then((r) => setTerms(r.data as { version: number; body: string }))
        .catch(() => {});
    }
  }, [step, termsRetry]);

  function next(s: Step) { setError(''); setStep(s); }

  async function submit() {
    if (!rFile) { setError('Upload the BOZ certificate to continue'); return; }
    if (!rAgreed) { setError('You must accept the Platform Terms to continue'); return; }
    setBusy(true); setError('');
    try {
      const reg = await api.post('/auth/register/tenant', {
        phone: rPhone,
        password: rPassword,
        email: rEmail,
        businessName: rName,
        businessType: rType,
        contactPerson: rContact,
        acceptedTermsVersion: terms?.version,
      });
      const d = reg.data as { accessToken: string; refreshToken: string };
      setTokens(d.accessToken, d.refreshToken);
      await refreshSession();
      nav('/verify');
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
          <AuthStepper steps={['Business', 'Account', 'BOZ upload']} current={0} />

          <div className="mb-3">
            <label className={lbl}>Business name <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} value={rName} onChange={(e) => setRName(e.target.value)} placeholder="Chilenje Community SACCO" />
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
            <input className={inp} value={rContact} onChange={(e) => setRContact(e.target.value)} placeholder="Full name" />
          </div>
          <div className="mb-4">
            <label className={lbl}>Phone number <em className="not-italic text-[#C62828]">*</em></label>
            <input className={`${inp} tabular-nums`} type="tel" inputMode="numeric" value={rPhone}
              onChange={(e) => setRPhone(e.target.value.replace(/\D/g, ''))} placeholder="0971234567" />
          </div>
          <button className={btn} disabled={!rName || !rContact || !rPhone} onClick={() => next(2)}>
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
            <input className={inp} type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)}
              placeholder="info@yourbusiness.zm" autoComplete="email" />
          </div>
          <div className="mb-4">
            <label className={lbl}>Password <em className="not-italic text-[#C62828]">*</em></label>
            <div className="relative">
              <input className={inp} type={showPw ? 'text' : 'password'} value={rPassword}
                onChange={(e) => setRPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888]">
                {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              </button>
            </div>
          </div>
          <button className={btn} disabled={!rEmail || rPassword.length < 8} onClick={() => next(3)}>
            Continue <FiArrowRight size={13} />
          </button>
          <p className="mt-3 text-center text-[11px] text-[#888]">
            <b className="cursor-pointer text-[#1A4FBF]" onClick={() => next(1)}>← Back</b>
          </p>
        </>
      )}

      {/* ══ STEP 3 — BOZ ══ */}
      {step === 3 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">BOZ certificate</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#888]">Proof of your lending license</p>
          <AuthStepper steps={['Business', 'Account', 'BOZ upload']} current={2} />

          <label className="mb-3 flex cursor-pointer flex-col items-center rounded-[3px] border-[1.5px] border-dashed border-[#B9C6E8] bg-[#EDF3FE] px-4 py-3.5 text-center hover:border-[#1A4FBF]">
            {rFile
              ? <span className="text-[12px] font-bold text-ink">✓ {rFile.name}</span>
              : <>
                  <b className="mt-1 block text-[11.5px] text-ink">Upload BOZ registration certificate</b>
                  <span className="text-[9.5px] text-[#888]">PDF or JPG · max 5MB</span>
                </>}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={(e) => setRFile(e.target.files?.[0] ?? null)} />
          </label>

          <div className="mb-3">
            <label className={lbl}>Owner NRC <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} value={rNrc} onChange={(e) => setRNrc(e.target.value)} placeholder="245711/63/1" />
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

          <label className="mb-3 flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={rAgreed} onChange={(e) => setRAgreed(e.target.checked)}
              className="mt-0.5 accent-[#1A4FBF]" />
            <span className="text-[10.5px] leading-[1.5] text-[#555]">
              I have read and accept the Platform Terms. Kumvwa provides software only and is not liable for lending decisions or client repayment.
            </span>
          </label>

          <button className={btn} disabled={busy || !rFile || !rNrc || !rAgreed || !terms} onClick={submit}>
            Submit for Verification <FiArrowRight size={13} />
          </button>
          <p className="mt-3 text-center text-[11px] text-[#888]">
            <b className="cursor-pointer text-[#1A4FBF]" onClick={() => next(2)}>← Back</b>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
