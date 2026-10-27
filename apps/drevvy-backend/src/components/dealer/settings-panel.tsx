'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CLOSE_FEE_COPY, formatMoney, formatStamp } from '@/lib/dealer/format';
import { DEMO_ROOFTOPS } from '@/lib/dealer/demo-org';
import type { BillingSnapshot } from '@/lib/dealer/types';

export function SettingsPanel({ billing }: { billing: BillingSnapshot }) {
  const [name, setName] = useState('Maya R.');
  const [email, setEmail] = useState('maya@lakesidehonda.com');
  const [alerts, setAlerts] = useState(true);
  const [cardNote, setCardNote] = useState<string | null>(null);

  return (
    <div className="row" style={{ gridTemplateColumns: '1fr' }}>
      <section className="g card">
        <div className="t">Profile</div>
        <p className="mut">Demo only. These fields stay on this page.</p>
        <label className="lab" htmlFor="profile-name">
          Name
        </label>
        <input
          id="profile-name"
          className="inp"
          value={name}
          onChange={event => setName(event.target.value)}
        />
        <label className="lab" htmlFor="profile-email">
          Work email
        </label>
        <input
          id="profile-email"
          className="inp"
          value={email}
          onChange={event => setEmail(event.target.value)}
        />
      </section>

      <section className="g card">
        <div className="t">Notifications</div>
        <label className="chk">
          <input
            type="checkbox"
            checked={alerts}
            onChange={event => setAlerts(event.target.checked)}
          />
          <div>Push + email when a shopper replies</div>
        </label>
      </section>

      <section className="g card">
        <div className="t">Store</div>
        <p className="mut">
          Demo rooftops for the Owner/GM switcher. Live matching still uses
          `dealerships` plus `user_dealerships`.
        </p>
        <ul>
          {DEMO_ROOFTOPS.map(rooftop => (
            <li key={rooftop.id} className="kc">
              <b>{rooftop.name}</b>
              <div className="mut">
                {rooftop.city} · doc fee {rooftop.docFee}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="g card">
        <div className="t">Billing · Owner/GM</div>
        <p className="t" style={{ marginTop: 8 }}>
          {CLOSE_FEE_COPY}
        </p>
        <p className="mut">
          Charged when a participating dealer marks a deal sold. Day-to-day use
          is free. Stripe is not connected. Shopper keys never appear here.
        </p>
        <div className="otd" style={{ marginTop: 12 }}>
          <p className="lab">Payment method</p>
          <p>
            {billing.paymentMethod.brand} ···· {billing.paymentMethod.last4}
          </p>
          <button
            type="button"
            className="btn2"
            style={{ marginTop: 8 }}
            onClick={() =>
              setCardNote('No card was saved. Stripe is not connected.')
            }
          >
            Replace card
          </button>
          {cardNote ? (
            <p className="mut" role="status">
              {cardNote}
            </p>
          ) : null}
        </div>
        <h3 className="lab" style={{ marginTop: 16 }}>
          Recent charges
        </h3>
        <table className="tbl">
          <tbody>
            {billing.charges.map(charge => (
              <tr key={charge.id}>
                <td>
                  {charge.shopperRef} · {charge.vehicleTitle}
                </td>
                <td>{formatMoney(charge.amountCents)}</td>
                <td className="mut">
                  {formatStamp(charge.closedAt)} · placeholder
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Link href="/dealer/login" className="btn2" style={{ width: 'fit-content' }}>
        Sign out
      </Link>
    </div>
  );
}
