import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_PERSONAS } from '@infraflow/shared';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/api';
import { Logo } from '@/components/shell/Logo';
import { DemoDataChip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { InfoBanner } from '@/components/ui/States';
import { TextInput } from '@/components/ui/Form';

const DEMO_PASSWORD = 'Demo@12345';

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === 'authed') return <Navigate to={from} replace />;

  const attempt = async (e: string, p: string, key: string) => {
    setBusy(key);
    setError(null);
    try {
      await login(e, p);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(null);
    }
  };

  const onSubmit = (ev: FormEvent) => {
    ev.preventDefault();
    void attempt(email.trim(), password, 'form');
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-outline-variant/40 bg-surface-container-lowest px-6 py-3">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <div className="flex flex-col">
            <span className="text-headline-md leading-tight text-primary">InfraFlow</span>
            <span className="font-code-sm text-code-sm text-on-surface-variant">Public works workflow &amp; monitoring</span>
          </div>
        </div>
        <DemoDataChip />
      </header>

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-6 px-4 py-8 lg:grid-cols-2">
        <section aria-labelledby="signin" className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
          <h1 id="signin" className="text-headline-xl text-primary">
            Sign in
          </h1>
          <p className="mt-1 text-body-md text-on-surface-variant">Use your demo account to open the workflow and monitoring workspace.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3" noValidate>
            <TextInput label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="officer@demo.infraflow.local" required />
            <TextInput label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error ? (
              <InfoBanner tone="rose" icon="error">
                {error}
              </InfoBanner>
            ) : null}
            <Button type="submit" variant="primary" className="w-full" loading={busy === 'form'} disabled={!email || !password || busy !== null} icon="login">
              Sign in
            </Button>
          </form>
          <p className="mt-4 text-body-sm text-on-surface-variant">
            All accounts and records in this prototype are synthetic. Demo password for every persona: <span className="font-code-tabular text-code-tabular text-on-surface">{DEMO_PASSWORD}</span>
          </p>
        </section>

        <section aria-labelledby="personas" className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-6 shadow-sm">
          <h2 id="personas" className="text-headline-md text-on-surface">
            Quick demo personas
          </h2>
          <p className="mt-1 text-body-sm text-on-surface-variant">One click signs in as the persona. Each sees only what their permissions allow.</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO_PERSONAS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => void attempt(p.email, DEMO_PASSWORD, p.key)}
                  disabled={busy !== null}
                  className="flex w-full items-start gap-2 rounded-lg border border-slate-300 bg-white p-2.5 text-left transition-colors hover:border-secondary hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary">
                    {busy === p.key ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Icon name="person" className="text-[16px]" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-label-lg font-semibold text-on-surface">{p.label}</span>
                    <span className="block text-body-sm text-on-surface-variant">{p.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-outline-variant/40 bg-surface-container-low px-4 py-2 text-center text-body-sm text-on-surface-variant">
        Technical prototype — rule registry pending departmental/legal review.
      </footer>
    </div>
  );
}
