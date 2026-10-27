'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ThemeToggle, useGlassTheme } from '@/components/glass/glass-theme';
import { DEMO_ROOFTOPS } from '@/lib/dealer/demo-org';

export function LoginForm() {
  const router = useRouter();
  const { rooftopId, setRooftopId } = useGlassTheme();
  const [email, setEmail] = useState('maya@lakesidehonda.com');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function sendLink(event: FormEvent) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a work email. Nothing is sent.');
      return;
    }
    setError(null);
    setSent(true);
  }

  function continueDemo(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter any 6 digits. No code is checked.');
      return;
    }
    router.push('/dealer/inbox');
  }

  return (
    <div className="ob">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
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
        onSubmit={sent ? continueDemo : sendLink}
      >
        <div className="h1">Sign in</div>
        <p className="mut" style={{ margin: '6px 0 18px' }}>
          Use your work email — we’ll send a 6-digit code. Demo only: nothing is
          sent, and no account is created.
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
              No email was sent. Enter any 6-digit code to open the demo inbox.
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
        <div className="lab" style={{ margin: '14px 0 8px' }}>
          Choose rooftop
        </div>
        {DEMO_ROOFTOPS.map(rooftop => (
          <label key={rooftop.id} className="chk">
            <input
              type="radio"
              name="rooftop"
              checked={rooftopId === rooftop.id}
              onChange={() => setRooftopId(rooftop.id)}
            />
            <div>
              <b>{rooftop.name}</b>
              <div className="mut">Owner/GM</div>
            </div>
          </label>
        ))}
        {error ? (
          <p className="dn" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn" style={{ width: '100%', marginTop: 8 }}>
          {sent ? 'Continue to Inbox' : 'Email me a link'}
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
