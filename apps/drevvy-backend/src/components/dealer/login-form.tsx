'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
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
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Drevvy
        </p>
        <h1 className="mt-1 text-2xl font-extrabold">Desk</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Work email sign-in is a stub. Drevvy connects an anonymous shopper
          with a salesperson in this chat. No message is sent, and no account is
          created.
        </p>
        <form onSubmit={sent ? continueDemo : sendLink} className="mt-6">
          <label htmlFor="work-email" className="text-xs font-semibold">
            Work email
          </label>
          <input
            id="work-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            placeholder="you@rooftop.example"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          {sent ? (
            <>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                No email was sent. Enter any 6-digit code to open the demo
                inbox.
              </p>
              <label
                htmlFor="otp-code"
                className="mt-3 block text-xs font-semibold"
              >
                One-time code
              </label>
              <input
                id="otp-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={event => setCode(event.target.value)}
                placeholder="123456"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </>
          ) : null}
          {error ? (
            <p
              className="mt-3 text-xs font-semibold text-[#B42828]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-gradient-to-br from-[#5B4FE9] to-[#3A6FF0] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(70,80,220,0.28)]"
          >
            {sent ? 'Continue to inbox' : 'Email me a link'}
          </button>
        </form>
      </div>
    </main>
  );
}
