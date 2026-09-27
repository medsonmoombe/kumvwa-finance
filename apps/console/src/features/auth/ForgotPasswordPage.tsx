import { useState } from 'react';
import { FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { AuthLayout, AuthStepper, OtpInput } from '../../components/kit';
import { ErrorBox } from '../../components/ui';
import { api, apiError } from '../../lib/api';

const inp =
  'w-full h-8 rounded-[3px] border border-[#D9DDE3] px-2.5 text-[12.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#A6ADC0] focus:border-[#1A4FBF] focus:shadow-[0_0_0_2px_rgba(26,79,191,0.12)]';
const lbl = 'mb-1 block text-[10.5px] font-semibold text-[#555]';
const btn =
  'flex w-full items-center justify-center gap-1.5 h-9 rounded-[3px] bg-[#1A4FBF] text-[11.5px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-[#12378F] disabled:opacity-40';

const BANNER = {
  heading: (
    <>
      Locked out?<br />
      <em className="not-italic text-[#7FE8AC]">Three steps back in.</em>
    </>
  ),
  sub: "Resetting signs out every device on the account — that's deliberate. If the reset wasn't requested by you, contact support immediately.",
  footerLabel: "If this wasn't you",
  footerBody: 'New sign-ins are emailed. Unknown device? Revoke it in Settings.',
};

export function ForgotPasswordPage() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [devCode, setDevCode] = useState('');

  const FOOTERS = [
    'Reset revokes all active sessions',
    'Failed attempts are logged',
    'New password takes effect immediately',
  ];

  async function request() {
    setBusy(true); setError('');
    try {
      const res = await api.post<{ sent: boolean; devCode?: string }>(
        '/auth/password/forgot', { email },
      );
      setDevCode(res.data.devCode ?? '');
      setStep(1);
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError('');
    try {
      await api.post('/auth/password/reset', { email, code: otp, newPassword: newPw });
      setStep(2);
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  return (
    <AuthLayout banner={BANNER} footer={FOOTERS[step]}>
      {error && <div className="mt-5 mb-0"><ErrorBox message={error} /></div>}

      {step === 0 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Reset password</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#888]">Enter your console email to receive a reset code</p>
          <AuthStepper steps={['Request', 'Code', 'New password']} current={0} />
          <div className="mb-4">
            <label className={lbl}>Email address <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.zm" />
          </div>
          <button className={btn} disabled={busy || !email.trim()} onClick={request}>
            Send Reset Code <FiArrowRight size={13} />
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Verify it's you</h2>
          <p className="mb-4 mt-1 text-[12px] text-[#888]">
            Code sent to <b className="text-ink">{email}</b>
          </p>
          <AuthStepper steps={['Request', 'Code', 'New password']} current={1} />
          <OtpInput value={otp} onChange={setOtp} error={!!error} />
          <div className="mb-3">
            <label className={lbl}>New password <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} type="password" value={newPw}
              onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 characters" />
          </div>
          <div className="mb-4 flex justify-end">
            <b className="cursor-pointer text-[10.5px] text-[#1A4FBF]" onClick={() => setStep(0)}>Go back</b>
          </div>
          <button className={btn} disabled={busy || otp.length < 6 || newPw.length < 8} onClick={confirm}>
            Verify <FiArrowRight size={13} />
          </button>
          {devCode && (
            <div className="mt-3 rounded-[3px] border border-dashed border-[#B9C6E8] bg-[#EDF3FE] px-3 py-2 text-[10.5px] text-[#1A4FBF]">
              Dev environment — your code is <b>{devCode}</b>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Password updated</h2>
          <p className="mb-6 mt-1 text-[12px] text-[#888]">All other sessions have been signed out.</p>
          <AuthStepper steps={['Request', 'Code', 'New password']} current={3} />
          <button className={btn} onClick={() => nav('/login')}>
            Back to Sign In <FiArrowRight size={13} />
          </button>
        </>
      )}

      {step < 2 && (
        <p className="mt-4 text-center text-[11.5px] text-[#888]">
          <b className="cursor-pointer text-[#1A4FBF]" onClick={() => nav('/login')}>← Back to sign in</b>
        </p>
      )}
    </AuthLayout>
  );
}
