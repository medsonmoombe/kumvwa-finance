import { useEffect, useRef, useState } from 'react';
import { FiArrowRight, FiEye, FiEyeOff, FiMonitor } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { AUTH_GUTTER, AuthLayout, OtpInput } from '../../components/kit';
import { ErrorBox } from '../../components/ui';
import { apiError, deviceToken, setDeviceToken } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const inp =
  'w-full h-8 rounded-[3px] border border-[#D9DDE3] px-2.5 text-[12.5px] text-ink outline-none transition-[border-color,box-shadow] placeholder:text-[#A6ADC0] focus:border-[#1A4FBF] focus:shadow-[0_0_0_2px_rgba(26,79,191,0.12)]';
const lbl = 'mb-1 block text-[10.5px] font-semibold text-[#555]';
const btn =
  'flex w-full items-center justify-center gap-1.5 h-9 rounded-[3px] bg-[#1A4FBF] text-[11.5px] font-extrabold uppercase tracking-wide text-white transition-colors hover:bg-[#12378F] disabled:opacity-40';
const sectionBand =
  `flex flex-wrap items-center gap-2 ${AUTH_GUTTER} pb-3 mb-4 border-b border-[#ECECEC]`;

type View = { k: 'login' } | { k: 'otp'; email: string; devCode: string };

const BANNERS: Record<View['k'], { heading: React.ReactNode; sub: string; footerLabel: string; footerBody: string }> = {
  login: {
    heading: <>Run your entire<br />lending operation<br /><em className="not-italic text-[#7FE8AC]">from one desk.</em></>,
    sub: "Clients, approvals, repayments and portfolio health. Built for Zambia's SACCOs, MFIs and licensed lenders.",
    footerLabel: 'Secured by design',
    footerBody: 'Two-factor sign-in · encrypted data · full audit trail',
  },
  otp: {
    heading: <>Two factors.<br /><em className="not-italic text-[#7FE8AC]">Every sign-in.</em></>,
    sub: 'A fresh code is emailed on every sign-in from a new device. Codes are single-use and expire in five minutes.',
    footerLabel: 'Why this matters',
    footerBody: 'Even a stolen password cannot open your loan book without your inbox.',
  },
};

const FOOTERS: Record<View['k'], string> = {
  login: 'Two-factor sign-in · all attempts logged',
  otp: 'Codes are single-use',
};

/** Shown when the API reports `otpFlow=disabled` — no 2FA language at all. */
const LOGIN_BANNER_NO_2FA = {
  ...BANNERS.login,
  footerBody: 'Encrypted data · full audit trail',
};
const LOGIN_FOOTER_NO_2FA = 'All attempts logged';

export function AuthPage() {
  const { loginStage1, loginStage2, otpFlowEnabled } = useAuth();
  const nav = useNavigate();

  const [view, setView] = useState<View>({ k: 'login' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [otp, setOtp] = useState('');
  const [hasTrustedDevice, setHasTrustedDevice] = useState(!!deviceToken());

  const [resendIn, setResendIn] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    timerRef.current = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [resendIn]);

  const countdown = `${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, '0')}`;

  async function doLogin() {
    setBusy(true); setError('');
    try {
      const res = await loginStage1(email, password);
      if (res.needs2fa) {
        setResendIn(58);
        setView({ k: 'otp', email, devCode: res.devCode ?? '' });
      } else if (res.error) {
        setError(res.error);
      } else {
        nav('/');
      }
    } catch (e) { setError(apiError(e)); }
    finally { setBusy(false); }
  }

  async function doOtp() {
    setBusy(true); setError('');
    const result = await loginStage2(otp, remember);
    setBusy(false);
    if (result) { setError(result); return; }
    nav('/');
  }

  async function resendOtp() {
    setResendIn(58);
    try { await loginStage1(email, password); } catch { /* silent */ }
  }

  // With 2FA off, the OTP banner/footer never apply and the login copy drops
  // every two-factor mention — the console never even hints at a code screen.
  const banner = view.k === 'otp'
    ? BANNERS.otp
    : otpFlowEnabled
      ? BANNERS.login
      : LOGIN_BANNER_NO_2FA;
  const footer = view.k === 'otp'
    ? FOOTERS.otp
    : otpFlowEnabled
      ? FOOTERS.login
      : LOGIN_FOOTER_NO_2FA;

  return (
    <AuthLayout banner={banner} footer={footer}>
      {error && <div className="mt-5 mb-0"><ErrorBox message={error} /></div>}

      {/* ══ LOGIN ══ */}
      {view.k === 'login' && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Welcome back</h2>
          <p className="mb-5 mt-1 text-[12px] text-[#888]">Sign in to the management console</p>

          <div className={sectionBand}>
            <span className="text-[12px] font-bold text-[#1A4FBF]">×</span>
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[#333]">Credentials</span>
          </div>

          <div className="mb-3">
            <label className={lbl}>Email address <em className="not-italic text-[#C62828]">*</em></label>
            <input className={inp} type="email" value={email} autoComplete="username"
              onChange={(e) => setEmail(e.target.value)} placeholder="you@yourbusiness.zm" />
          </div>
          <div className="mb-3">
            <label className={lbl}>Password <em className="not-italic text-[#C62828]">*</em></label>
            <div className="relative">
              <input className={inp} type={showPw ? 'text' : 'password'} value={password}
                autoComplete="current-password" onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#888]">
                {showPw ? <FiEyeOff size={14} /> : <FiEye size={14} />}
              </button>
            </div>
          </div>
          <div className={`mb-4 flex items-center ${otpFlowEnabled ? 'justify-between' : 'justify-end'}`}>
            {otpFlowEnabled && (
              <Cbx checked={remember} onChange={setRemember} label="Remember device 30d" />
            )}
            <button className="text-[11px] font-bold text-[#1A4FBF]" onClick={() => nav('/forgot-password')}>
              Forgot password?
            </button>
          </div>
          {otpFlowEnabled && hasTrustedDevice && (
            <div className="mb-3 flex items-center justify-between rounded-[3px] border border-[#B9C6E8] bg-[#EDF3FE] px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-[#1A4FBF]">
                <FiMonitor size={13} />
                <span>Trusted device — 2FA will be skipped</span>
              </div>
              <button
                className="text-[10.5px] font-bold text-[#C62828] hover:underline"
                onClick={() => { setDeviceToken(null); setHasTrustedDevice(false); }}
              >
                Remove trust
              </button>
            </div>
          )}
          <button className={btn} disabled={busy || !email || !password} onClick={doLogin}>
            Sign In <FiArrowRight size={13} />
          </button>
          <p className="mt-4 text-center text-[11.5px] text-[#888]">
            New to Kumvwa?{' '}
            <b className="cursor-pointer text-[#1A4FBF]" onClick={() => nav('/register')}>Register your business</b>
          </p>
          {!otpFlowEnabled && (
            <p className="mt-2 text-center text-[10.5px] text-[#888]">
              Two-factor sign-in is temporarily off. You'll be signed in with your email and password.
            </p>
          )}
        </>
      )}

      {/* ══ OTP ══ */}
      {view.k === 'otp' && (
        <>
          <h2 className="mt-5 font-display text-[20px] font-bold tracking-tight text-ink">Verify it's you</h2>
          <p className="mb-5 mt-1 text-[12px] text-[#888]">
            Code sent to <b className="text-ink">{view.email}</b> · single use · 5 min expiry
          </p>

          <div className={sectionBand}>
            <span className="text-[12px] font-bold text-[#1A4FBF]">×</span>
            <span className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[#333]">Verification Code</span>
          </div>

          <OtpInput value={otp} onChange={setOtp} error={!!error} />
          <div className="mb-3.5 flex items-center justify-between text-[10.5px]">
            {resendIn > 0
              ? <span className="font-bold text-[#1A4FBF]">Resend in {countdown}</span>
              : <b className="cursor-pointer text-[#1A4FBF]" onClick={resendOtp}>Resend code</b>}
            <b className="cursor-pointer text-[#1A4FBF]" onClick={() => { setView({ k: 'login' }); setError(''); }}>
              Wrong email? Go back
            </b>
          </div>
          <Cbx checked={remember} onChange={setRemember} label="Remember this device for 30 days" className="mb-4" />
          <button className={btn} disabled={busy || otp.length < 6} onClick={doOtp}>
            Verify and Sign In <FiArrowRight size={13} />
          </button>
          {view.devCode && <DevCode code={view.devCode} />}
        </>
      )}
    </AuthLayout>
  );
}

function Cbx({ checked, onChange, label, className = '' }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; className?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-1.5 text-[11px] text-[#555] ${className}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#1A4FBF]" />
      {label}
    </label>
  );
}

function DevCode({ code }: { code: string }) {
  return (
    <div className="mt-3 rounded-[3px] border border-dashed border-[#B9C6E8] bg-[#EDF3FE] px-3 py-2 text-[10.5px] text-[#1A4FBF]">
      Dev environment — your code is <b>{code}</b>
    </div>
  );
}
