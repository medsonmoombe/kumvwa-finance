import { useEffect, useRef, useState } from 'react';
import {
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiTool,
} from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

import { ErrorBox, Spinner } from '../../components/ui';
import { api, apiError, setTokens } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type Mode = 'login' | 'register' | 'otp' | 'forgot' | 'reset';

function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div className="my-4 flex gap-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          className={`h-[50px] min-w-0 flex-1 rounded-xl border-[1.5px] bg-white text-center font-display text-[18px] font-bold text-ink outline-none ${
            value[i]
              ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgba(46,99,230,0.1)]'
              : 'border-line'
          }`}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '');
            if (!d) return;
            onChange(
              (value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6),
            );
            if (i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) {
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const t = e.clipboardData
              .getData('text')
              .replace(/\D/g, '')
              .slice(0, 6);
            if (t) {
              onChange(t);
              refs.current[Math.min(t.length, 5)]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}

export function AuthPage() {
  const { login, refreshSession } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('sacco');
  const [devCode, setDevCode] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [terms, setTerms] = useState<{ version: number; body: string } | null>(
    null,
  );
  const [agreed, setAgreed] = useState(false);

  // Registration is terms-gated: fetch the current platform terms to show
  // and to send back as `acceptedTermsVersion`.
  useEffect(() => {
    if (mode === 'register') {
      api
        .get('/terms/platform')
        .then((r) => setTerms(r.data as { version: number; body: string }))
        .catch(() => undefined);
    }
  }, [mode]);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        const err = await login(phone, password);
        if (err === null) {
          nav('/');
          return;
        }
        setError(err);
      } else if (mode === 'register') {
        const res = await api.post('/auth/otp/request', {
          phone,
          purpose: 'registration',
        });
        setDevCode((res.data.devCode as string) ?? '');
        setMode('otp');
      } else if (mode === 'forgot') {
        const res = await api.post('/auth/password/forgot', { phone });
        setDevCode((res.data.devCode as string) ?? '');
        setMode('reset');
      } else if (mode === 'reset') {
        if (password !== confirm) {
          setError('Passwords do not match');
          return;
        }
        const v = await api.post('/auth/otp/verify', {
          phone,
          purpose: 'password_reset',
          code: otp,
        });
        await api.post('/auth/password/reset', {
          phone,
          otpToken: v.data.otpToken,
          newPassword: password,
        });
        setOtp('');
        setPassword('');
        setConfirm('');
        setDevCode('');
        setNotice(
          'Password updated. Log in with your new password — all other sessions were signed out.',
        );
        setMode('login');
      } else {
        const v = await api.post('/auth/otp/verify', {
          phone,
          purpose: 'registration',
          code: otp,
        });
        const reg = await api.post('/auth/register/tenant', {
          phone,
          password,
          businessName,
          businessType,
          otpToken: v.data.otpToken,
          acceptedTermsVersion: terms?.version,
        });
        setTokens(reg.data.accessToken, reg.data.refreshToken);
        await refreshSession();
        nav('/verify');
      }
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  const input =
    'w-full rounded-input border-[1.5px] border-line bg-white px-4 py-3 text-[14px] text-ink outline-none placeholder:text-gray-400 focus:border-brand-500 focus:shadow-[0_0_0_3px_rgba(46,99,230,0.1)]';
  const label = 'mb-1.5 block text-[12.5px] font-semibold text-ink';

  const heading =
    mode === 'login'
      ? 'Welcome back'
      : mode === 'register'
        ? 'Register your business'
        : mode === 'forgot'
          ? 'Reset your password'
          : mode === 'reset'
            ? 'Choose a new password'
            : 'Check your phone';
  const sub =
    mode === 'login'
      ? 'Log in to the management console'
      : mode === 'register'
        ? 'BOZ-registered lenders only · Step 1 of 2'
        : mode === 'forgot'
          ? "Enter the phone registered to your account — we'll text you a code"
          : mode === 'reset'
            ? `Enter the 6-digit code sent to ${phone}`
            : `We sent a 6-digit code to ${phone}`;

  return (
    <div className="flex min-h-screen">
      {/* ── brand panel ── */}
      <div className="relative hidden flex-[1.15] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-600 via-brand-900 to-[#071838] p-11 lg:flex">
        <div className="pointer-events-none absolute -right-28 -top-32 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(46,204,113,0.22),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(46,99,230,0.4),transparent_65%)]" />
        <div className="relative z-10 flex h-[54px] w-[54px] items-center justify-center rounded-[17px] bg-gradient-to-br from-brand-500 to-accent-500 font-display text-[25px] font-extrabold text-white shadow-c3">
          K
        </div>
        <div className="relative z-10">
          <h3 className="font-display text-[25px] leading-[1.32] tracking-tight text-white">
            {mode === 'login' ? (
              <>
                Run your entire
                <br />
                lending operation
                <br />
                <em className="not-italic text-[#7FE8AC]">from one desk.</em>
              </>
            ) : mode === 'register' || mode === 'otp' ? (
              <>
                Two steps to
                <br />
                <em className="not-italic text-[#7FE8AC]">get verified.</em>
              </>
            ) : (
              <>
                Back into
                <br />
                <em className="not-italic text-[#7FE8AC]">your account.</em>
              </>
            )}
          </h3>
          <p className="mt-4 max-w-[320px] text-[12.5px] leading-[1.7] text-[#A9BEE8]">
            {mode === 'login' ? (
              "Clients, invites, approvals, repayments and portfolio health — built for Zambia's SACCOs, MFIs and licensed lenders."
            ) : mode === 'register' || mode === 'otp' ? (
              'Confirm your phone, then upload your Bank of Zambia certificate. Most reviews complete within 1–2 business days.'
            ) : (
              'Confirm your phone, then choose a new password. Every active session will be signed out.'
            )}
          </p>
        </div>
      </div>

      {/* ── form panel ── */}
      <div className="flex flex-1 items-center justify-center bg-white p-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-gradient-to-br from-brand-500 to-brand-900 font-display text-xl font-extrabold text-white lg:hidden">
            K
          </div>
          <h2 className="font-display text-[23px] font-bold tracking-tight text-ink">
            {heading}
          </h2>
          <p className="mb-6 mt-1.5 text-[12.5px] text-ink-muted">{sub}</p>

          {(mode === 'otp' || mode === 'reset') && (
            <div className="space-y-4">
              <OtpInput value={otp} onChange={setOtp} />
              {mode === 'reset' && (
                <>
                  <div>
                    <label className={label}>New password</label>
                    <input
                      className={input}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div>
                    <label className={label}>Confirm new password</label>
                    <input
                      className={input}
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Re-enter your new password"
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-bold text-brand-600">
                  Resend code in 0:42
                </span>
                <button
                  className="font-bold text-brand-600"
                  onClick={() =>
                    setMode(mode === 'otp' ? 'register' : 'forgot')
                  }
                >
                  Wrong number? Edit
                </button>
              </div>
              {notice && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[11px] text-emerald-700">
                  {notice}
                </div>
              )}
              {error && <ErrorBox message={error} />}
              <button
                disabled={
                  busy ||
                  otp.length < 6 ||
                  (mode === 'reset' && (!password || !confirm))
                }
                onClick={submit}
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-btn bg-brand-600 text-[14px] font-bold text-white shadow-c1 hover:bg-brand-900 disabled:opacity-40"
              >
                {busy ? (
                  <Spinner className="border-white" />
                ) : (
                  <>
                    {mode === 'otp' ? 'Verify &amp; Continue' : 'Reset Password'}{' '}
                    <FiArrowRight size={15} />
                  </>
                )}
              </button>
              {devCode && (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-brand-100 bg-brand-50 px-3.5 py-2.5 text-[11px] text-brand-600">
                  <FiTool size={13} className="shrink-0" /> Dev mode — your code
                  is <b>{devCode}</b> (SMS provider not yet connected)
                </div>
              )}
            </div>
          )}

          {mode !== 'otp' && mode !== 'reset' && (
            <div className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className={label}>Business name</label>
                    <input
                      className={input}
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Chilenje Community SACCO"
                    />
                  </div>
                  <div>
                    <label className={label}>Business type</label>
                    <select
                      className={input}
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    >
                      <option value="sacco">SACCO / Cooperative</option>
                      <option value="mfi">Microfinance Institution</option>
                      <option value="individual_lender">
                        Individual Lender
                      </option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {terms && (
                    <div className="rounded-xl border border-line bg-surface p-3.5">
                      <div className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-2">
                        {terms.body}
                      </div>
                      <label className="mt-2.5 flex items-start gap-2 text-[11.5px] text-ink-2">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="mt-0.5 accent-brand-600"
                        />
                        <span>
                          I have read and accept the Platform Terms. I understand
                          Kumvwa provides software tools only, is not a lender, and
                          is not liable for lending decisions or client repayment.
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className={label}>Phone number</label>
                <input
                  className={`${input} tabular-nums`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="097 1234567"
                />
              </div>
              {mode !== 'forgot' && (
                <div>
                  <label className={label}>Password</label>
                  <div className="relative">
                    <input
                      className={input}
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-3.5 text-ink-muted hover:text-ink"
                    >
                      {showPw ? <FiEyeOff size={15} /> : <FiEye size={15} />}
                    </button>
                  </div>
                </div>
              )}
              {mode === 'login' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[12.5px] font-bold text-brand-600 hover:text-brand-900"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setNotice('');
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              )}
              {notice && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[11px] text-emerald-700">
                  {notice}
                </div>
              )}
              {error && <ErrorBox message={error} />}
              <button
                disabled={
                  busy ||
                  !phone ||
                  (mode !== 'forgot' && !password) ||
                  (mode === 'register' && (!agreed || !terms))
                }
                onClick={submit}
                className="flex h-[48px] w-full items-center justify-center gap-2 rounded-btn bg-brand-600 text-[14px] font-bold text-white shadow-c1 hover:bg-brand-900 disabled:opacity-40"
              >
                {busy ? (
                  <Spinner className="border-white" />
                ) : (
                  <>
                    {mode === 'login'
                      ? 'Log In'
                      : mode === 'forgot'
                        ? 'Send Code'
                        : 'Continue'}{' '}
                    <FiArrowRight size={15} />
                  </>
                )}
              </button>
              <p className="text-center text-[12.5px] text-ink-muted">
                {mode === 'login'
                  ? 'New to Kumvwa? '
                  : mode === 'register'
                    ? 'Already registered? '
                    : 'Remember your password? '}
                <button
                  className="font-bold text-brand-600"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                    setNotice('');
                  }}
                >
                  {mode === 'login' ? 'Register your business' : 'Log in'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
