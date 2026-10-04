import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useGSAP } from '@gsap/react';
import { gsap } from '../lib/gsap';
import { useAuth } from '../lib/auth';
import { isDemo } from '../lib/db';
import { homeFor, ROLE_LABEL } from '../lib/roles';
import { DEMO_USERS, DEMO_PASSWORD } from '../data/seed';
import { validate, required, email as isEmail } from '../lib/validate';
import Breadcrumb from '../components/ui/Breadcrumb';
import Logo from '../components/ui/Logo';
import { Field, Input, ErrorNote } from '../components/ui/kit';

/** /login — staff sign-in. Sends each role to the right admin page afterwards. */
export default function Login() {
  const { user, signIn, signOut, resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next');
  const root = useRef(null);

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | busy | error | reset-sent
  const [message, setMessage] = useState('');

  useGSAP(
    () => {
      gsap.from('.login-card', { y: 40, opacity: 0, duration: 0.9, ease: 'expo.out', delay: 0.2 });
      gsap.from('.login-logo', { rotate: -90, scale: 0.6, opacity: 0, duration: 1.1, ease: 'back.out(1.6)', delay: 0.3 });
      gsap.to('.login-ring', { rotate: 360, duration: 30, ease: 'none', repeat: -1 });
    },
    { scope: root },
  );

  const go = (u) => navigate(next && next.startsWith('/admin') ? next : homeFor(u.role), { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form, { email: [required(), isEmail()], password: [required()] });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStatus('busy');
    setMessage('');
    try {
      const u = await signIn(form.email, form.password);
      go(u);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  const forgot = async () => {
    const errs = validate(form, { email: [required('Type your email first'), isEmail()] });
    setErrors(errs);
    if (errs.email) return;
    try {
      await resetPassword(form.email);
      setStatus('reset-sent');
      setMessage('Check your inbox for a reset link.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  // already logged in? offer to continue
  useEffect(() => {
    if (!loading && user && next) go(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section ref={root} className="section page-top flex min-h-screen flex-col">
      <Breadcrumb parts={['Login']} />
      <div className="relative mx-auto mt-10 grid w-full max-w-[980px] items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* left: brand */}
        <div className="relative hidden flex-col justify-center lg:flex" style={{ minHeight: 420 }}>
          <svg className="login-ring pointer-events-none absolute -left-10 top-0 h-[420px] w-[420px] opacity-40" viewBox="0 0 200 200" fill="none" aria-hidden="true">
            <circle cx="100" cy="100" r="96" stroke="var(--line)" strokeDasharray="2 6" />
            <circle cx="100" cy="100" r="70" stroke="var(--line)" />
            <circle cx="100" cy="4" r="3" fill="var(--blue)" />
          </svg>
          <div className="login-logo relative">
            <Logo size={88} />
          </div>
          <h1 className="display relative mt-8 text-5xl font-bold leading-[1.05]">
            Club
            <br />
            control room.
          </h1>
          <p className="relative mt-4 max-w-sm text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            For the committee only: publish events and announcements, review ideas, update projects and the gallery.
          </p>
        </div>

        {/* right: form */}
        <div className="login-card glass p-6 md:p-8">
          {user ? (
            <div>
              <div className="mono text-[10px] tracking-[0.25em]" style={{ color: 'var(--blue-glow)' }}>
                SIGNED IN
              </div>
              <div className="display mt-2 text-2xl font-bold">{user.full_name}</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                {user.email} · {ROLE_LABEL[user.role]}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <button className="ctl-btn primary" onClick={() => go(user)}>
                  Open dashboard →
                </button>
                <button className="ctl-btn" onClick={signOut}>
                  Log out
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="flex flex-col gap-5">
              <div>
                <div className="display text-2xl font-bold">Log in</div>
                <div className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  Use the account the club admin created for you.
                </div>
              </div>
              <Field label="Email" error={errors.email}>
                <Input type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="you@nitandhra.ac.in" />
              </Field>
              <Field label="Password" error={errors.password}>
                <Input type="password" autoComplete="current-password" value={form.password} onChange={set('password')} error={errors.password} placeholder="••••••••" />
              </Field>
              {status === 'error' && <ErrorNote>{message}</ErrorNote>}
              {status === 'reset-sent' && (
                <div className="text-sm" style={{ color: 'var(--ok)' }}>
                  {message}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button className="ctl-btn primary" disabled={status === 'busy'} style={{ padding: '0.8rem 1.4rem' }}>
                  {status === 'busy' ? 'Checking…' : 'Log in →'}
                </button>
                {!isDemo && (
                  <button type="button" onClick={forgot} className="text-xs underline-offset-4 hover:underline" style={{ color: 'var(--muted)' }}>
                    Forgot password?
                  </button>
                )}
              </div>
            </form>
          )}

          {isDemo && !user && (
            <div className="mt-8 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
              <div className="mono text-[10px] tracking-[0.22em]" style={{ color: 'var(--warn)' }}>
                DEMO MODE · PASSWORD {DEMO_PASSWORD}
              </div>
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                No database connected yet. Pick a role to try it — each one sees different edit rights.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {DEMO_USERS.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    className="ctl-btn text-left"
                    style={{ textTransform: 'none', letterSpacing: '0.02em', fontSize: 11 }}
                    onClick={() => {
                      setForm({ email: u.email, password: DEMO_PASSWORD });
                      setErrors({});
                    }}
                  >
                    <span className="block" style={{ color: 'var(--blue-glow)' }}>
                      {ROLE_LABEL[u.role]}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>{u.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
