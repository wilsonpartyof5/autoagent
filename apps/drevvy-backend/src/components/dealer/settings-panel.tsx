'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CLOSE_FEE_COPY, formatMoney, formatStamp } from '@/lib/dealer/format';
import { DEMO_ROOFTOP, type BillingSnapshot } from '@/lib/dealer/types';

const TEAM = [
  { name: 'Dana Ruiz', role: 'Manager' },
  { name: 'Sam Patel', role: 'Salesperson' },
];

export function SettingsPanel({ billing }: { billing: BillingSnapshot }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rooftop, setRooftop] = useState<string>(DEMO_ROOFTOP.name);
  const [docFee, setDocFee] = useState(
    String(DEMO_ROOFTOP.docFeeDefaultCents / 100)
  );
  const [newConversation, setNewConversation] = useState(true);
  const [waiting, setWaiting] = useState(true);
  const [cardNote, setCardNote] = useState<string | null>(null);

  return (
    <div className="h-full overflow-y-auto px-5 py-6">
      <h1 className="text-lg font-extrabold">Settings</h1>
      <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
        Demo only. These fields stay on this page. Nothing is saved. Day-to-day
        use is free. There is no shopper paywall on this desk.
      </p>

      <section className="mt-6 max-w-xl rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-extrabold">Profile</h2>
        <label
          htmlFor="profile-name"
          className="mt-3 block text-xs font-semibold"
        >
          Name
        </label>
        <input
          id="profile-name"
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="Your name"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <label
          htmlFor="profile-email"
          className="mt-3 block text-xs font-semibold"
        >
          Work email
        </label>
        <input
          id="profile-email"
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="Work email"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </section>

      <section className="mt-4 max-w-xl rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-extrabold">Notifications</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Not connected.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={newConversation}
            onChange={event => setNewConversation(event.target.checked)}
          />
          New conversation
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={waiting}
            onChange={event => setWaiting(event.target.checked)}
          />
          A shopper is waiting on a reply
        </label>
      </section>

      <section className="mt-4 max-w-xl rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-extrabold">Store</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          One demo rooftop. Multi-store is an open question. The doc fee is a
          default on this screen, not a quote.
        </p>
        <label
          htmlFor="rooftop-name"
          className="mt-3 block text-xs font-semibold"
        >
          Rooftop
        </label>
        <input
          id="rooftop-name"
          value={rooftop}
          onChange={event => setRooftop(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <label htmlFor="doc-fee" className="mt-3 block text-xs font-semibold">
          Doc fee default
        </label>
        <input
          id="doc-fee"
          inputMode="decimal"
          value={docFee}
          onChange={event => setDocFee(event.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </section>

      <section className="mt-4 max-w-xl rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-extrabold">Billing</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Manager and Admin. This demo is signed in as a manager. Stripe is not
          connected.
        </p>
        <p className="mt-3 text-sm font-extrabold">{CLOSE_FEE_COPY}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Charged when a participating dealer marks a deal sold. The desk stays
          free until then.
        </p>
        <div className="mt-3 rounded-xl border border-dashed border-border bg-background p-3">
          <p className="text-xs font-semibold">Payment method</p>
          <p className="mt-1 text-sm">
            {billing.paymentMethod.brand} ···· {billing.paymentMethod.last4}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Placeholder card. No payment is stored or sent.
          </p>
          <button
            type="button"
            onClick={() =>
              setCardNote('No card was saved. Stripe is not connected.')
            }
            className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold"
          >
            Replace card
          </button>
          {cardNote ? (
            <p className="mt-2 text-xs font-semibold" role="status">
              {cardNote}
            </p>
          ) : null}
        </div>
        <h3 className="mt-4 text-xs font-extrabold">Recent charges</h3>
        <ul className="mt-2 divide-y divide-border">
          {billing.charges.map(charge => (
            <li key={charge.id} className="py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">
                  {charge.shopperRef} · {charge.vehicleTitle}
                </span>
                <span>{formatMoney(charge.amountCents)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatStamp(charge.closedAt)} · placeholder
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-4 max-w-xl rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-extrabold">Team</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Placeholder for managers and above. Who can share numbers, and how
          accounts are provisioned, are open questions.
        </p>
        <ul className="mt-3 divide-y divide-border">
          {TEAM.map(person => (
            <li
              key={person.name}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="font-semibold">{person.name}</span>
              <span className="text-muted-foreground">{person.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/dealer/login"
        className="mt-6 inline-flex rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold"
      >
        Sign out
      </Link>
      <p className="mt-2 text-xs text-muted-foreground">
        Returns to the demo login. There is no account yet.
      </p>
    </div>
  );
}
