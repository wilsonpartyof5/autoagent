'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ThemeToggle } from '@/components/glass/glass-theme';
import { createClient } from '@/lib/supabase/client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    const workEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail)) {
      setError('Enter a work email.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: workEmail,
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        setError(otpError.message || 'Drevvy could not email a sign-in code.');
        return;
      }
      setSent(true);
    } catch {
      setError('Drevvy could not email a sign-in code.');
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (verifyError) {
        setError(verifyError.message || 'That code did not match.');
        return;
      }
      const session = await fetch('/api/dealer/v1/session', { credentials: 'include' });
      if (session.status === 403) {
        await supabase.auth.signOut();
        setError('This work email is not on a Drevvy rooftop.');
        return;
      }
      if (!session.ok) {
        setError('Signed in, but Drevvy could not load rooftop access.');
        return;
      }
      router.push('/dealer/inbox');
      router.refresh();
    } catch {
      setError('That code did not match.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="ob">
      <div className="top g" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link className="logo" href="/dealer/inbox">
            D
          </Link>
          <div className="wm">
            Drevvy <span>Dealer</span>
          </div>
        </div>
        <ThemeToggle />
      </div>
      <form
        className="g card"
        style={{ padding: 28, marginTop: 18 }}
        onSubmit={sent ? verifyCode : sendCode}
      >
        <div className="h1">Sign in</div>
        <p className="mut" style={{ margin: '6px 0 18px' }}>
          Use your work email. We’ll send a 6-digit code. Only rooftop members
          can open the desk.
        </p>
        <label className="lab" htmlFor="work-email">
          Work email
        </label>
        <input
          id="work-email"
          className="inp"
          type="email"
          autoComplete="username"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
        {sent ? (
          <>
            <p className="mut" style={{ margin: '12px 0' }}>
              Enter the 6-digit code we sent to {email.trim()}.
            </p>
            <label className="lab" htmlFor="otp-code">
              One-time code
            </label>
            <input
              id="otp-code"
              className="inp"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={event => setCode(event.target.value)}
              placeholder="123456"
            />
          </>
        ) : null}
        {error ? (
          <p className="dn" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="btn"
          style={{ width: '100%', marginTop: 8 }}
          disabled={pending}
        >
          {sent ? 'Continue to Inbox' : 'Email me a code'}
        </button>
        <p className="mut" style={{ marginTop: 12, textAlign: 'center' }}>
          New dealer?{' '}
          <Link href="/dealer/invite/demo" style={{ color: 'var(--acc)' }}>
            Accept invite
          </Link>
        </p>
      </form>
    </div>
  );
}
