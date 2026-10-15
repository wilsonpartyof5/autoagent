import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { deliverShopperPush } from './dispatch';
import { createMemoryPushLedger, selectPushLedger } from './ledger';
import { sendPush } from './send';
import {
  applyPushFact,
  composeShopperPush,
  didYouBuyOnServer,
  hasContact,
  offerReadyDecision,
  priceDropDecision,
  priceDropsEnabled,
  publicPushFields,
  readOptionalDealerName,
  readPriceDropPreference,
  readPushFact,
  type PushFact,
  type PushLedger,
} from './triggers';

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = '22222222-2222-4222-8222-222222222222';
const DEAL = '33333333-3333-4333-8333-333333333333';
const VEHICLE = { year: 2024, make: 'Toyota', model: 'RAV4' };
const DEALER = 'Lakeside Toyota';
const PHONE = '704-555-0199';
const EMAIL = 'sales@lakeside.example';

test('price-drop pushes are on unless the shopper turns them off', () => {
  assert.equal(priceDropsEnabled(undefined), true);
  assert.equal(priceDropsEnabled(null), true);
  assert.equal(priceDropsEnabled(true), true);
  assert.equal(priceDropsEnabled(false), false);
  assert.equal(priceDropDecision({ previousPrice: null, price: 34850, priceDrops: null }), 'first_seen');
  assert.equal(priceDropDecision({ previousPrice: 35250, price: 35250, priceDrops: null }), 'not_lower');
  assert.equal(priceDropDecision({ previousPrice: 35250, price: 36000, priceDrops: true }), 'not_lower');
  assert.equal(priceDropDecision({ previousPrice: 35250, price: 34850, priceDrops: null }), 'send');
  assert.equal(priceDropDecision({ previousPrice: 35250, price: 34850, priceDrops: false }), 'disabled');
  assert.equal(readPriceDropPreference({ priceDrops: false }), false);
  assert.throws(() => readPriceDropPreference({ priceDrops: 'yes' }));
});

test('pushes omit dealer identity until the official offer is forwarded', () => {
  const before = ['price_drop', 'offer_ready', 'car_sold', 'official_offer', 'did_you_buy'] as const;
  for (const event of before) {
    const push = composeShopperPush({
      event,
      userId: USER,
      dealId: DEAL,
      listingId: 'mc-rav4',
    }, {
      offerForwarded: false,
      dealerName: DEALER,
      vehicle: VEHICLE,
      previousPrice: 35250,
      price: 34850,
      offerAmount: 37824,
    });
    const visible = `${push.title} ${push.body} ${JSON.stringify(publicPushFields(push).data)}`;
    assert.equal(visible.includes('Lakeside'), false, event);
    assert.equal(visible.includes('704'), false, event);
    assert.equal(visible.includes('sales@'), false, event);
    assert.equal(visible.toLowerCase().includes('transparency'), true, event);
    assert.equal(/negotiat/i.test(visible), false, event);
    assert.equal(/just sold/i.test(visible), false, event);
  }

  const forwarded = composeShopperPush({
    event: 'official_offer',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
  }, {
    offerForwarded: true,
    dealerName: DEALER,
    vehicle: VEHICLE,
  });
  assert.match(forwarded.body ?? '', /Official offer from Lakeside Toyota/);
  assert.equal((forwarded.body ?? '').toLowerCase().includes('transparency'), true);
  const leakedForward = composeShopperPush({
    event: 'official_offer',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
  }, { offerForwarded: true, dealerName: `${DEALER} ${PHONE}` });
  assert.equal((leakedForward.body ?? '').includes('704'), false);
  assert.equal((leakedForward.body ?? '').includes('Lakeside'), false);
  assert.equal(readOptionalDealerName({ dealerName: `  ${DEALER}  `, street: '100 Dealer Way' }), DEALER);
  const phoneNamed = composeShopperPush({
    event: 'price_drop',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
  }, {
    offerForwarded: false,
    dealerName: `${DEALER} ${PHONE} ${EMAIL} https://lakeside.example`,
    vehicle: VEHICLE,
    previousPrice: 35250,
    price: 34850,
  });
  assert.equal(`${phoneNamed.title} ${phoneNamed.body}`.includes('704'), false);
  assert.equal(`${phoneNamed.title} ${phoneNamed.body}`.includes('lakeside.example'), false);
  assert.equal(readOptionalDealerName({ dealerName: PHONE }), null);
  assert.equal(readOptionalDealerName({ dealerName: EMAIL }), null);
  assert.equal(hasContact(`Call ${PHONE}`), true);
  assert.equal(hasContact('The listed price is now $34,850.'), false);
});

test('car sold asks the shopper to add another and did-you-buy waits for the day after pickup', () => {
  const sold = composeShopperPush({
    event: 'car_sold',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
  }, { offerForwarded: true, dealerName: DEALER, vehicle: VEHICLE });
  assert.match(sold.title ?? '', /RAV4 is no longer listed/);
  assert.match(sold.body ?? '', /add another/i);
  assert.equal(sold.prompt, 'add_another');
  assert.equal(publicPushFields(sold).data.prompt, 'add_another');
  assert.equal(JSON.stringify(publicPushFields(sold).data).includes('Lakeside'), false);

  const ask = composeShopperPush({
    event: 'did_you_buy',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
  }, { offerForwarded: true, dealerName: DEALER, vehicle: VEHICLE });
  assert.equal(ask.title, 'Did you buy it?');
  assert.match(ask.body ?? '', /RAV4/);
  assert.equal((ask.body ?? '').includes('Lakeside'), false);
  assert.equal(didYouBuyOnServer('geofence_exit'), false);
  assert.equal(didYouBuyOnServer('pickup_fallback'), true);
});

test('a listing price drop and a new offer each send once, and a drop respects the default', async () => {
  const ledger = createMemoryPushLedger();
  const sent: string[] = [];
  const deliver = async (push: { event: string; title?: string; body?: string }) => {
    sent.push(`${push.event}:${push.title}`);
    assert.equal((push.body ?? '').includes('Lakeside'), false);
    assert.equal((push.body ?? '').toLowerCase().includes('transparency'), true);
    return { event: push.event as 'price_drop', title: push.title ?? '', body: push.body ?? '', targeted: 1, delivered: 1, reason: 'sent' as const };
  };

  const first = await applyPushFact(priceFact(35250), { ledger, deliver });
  assert.equal(first.reason, 'first_seen');
  assert.equal(sent.length, 0);

  const drop = await applyPushFact(priceFact(34850), { ledger, deliver });
  assert.equal(drop.reason, 'sent');
  assert.match(drop.body ?? '', /\$400/);
  assert.match(drop.body ?? '', /\$34,850/);
  assert.match(drop.body ?? '', /RAV4/);

  const again = await applyPushFact(priceFact(34850), { ledger, deliver });
  assert.equal(again.reason, 'not_lower');
  assert.equal(sent.length, 1);

  const offer = await applyPushFact(offerFact(37824), { ledger, deliver });
  const repeat = await applyPushFact(offerFact(37824), { ledger, deliver });
  const changed = await applyPushFact(offerFact(36900), { ledger, deliver });
  assert.equal(offer.reason, 'sent');
  assert.match(offer.body ?? '', /\$37,824/);
  assert.equal(repeat.reason, 'unchanged_offer');
  assert.equal(changed.reason, 'sent');
  assert.deepEqual(sent, ['price_drop:Price dropped', 'offer_ready:Offer ready', 'offer_ready:Offer ready']);
  assert.equal(offerReadyDecision(37824, 37824), 'unchanged_offer');
});

test('a shopper who turns price drops off does not get that push', async () => {
  const ledger = createMemoryPushLedger();
  await ledger.setPreference(USER, false);
  let called = false;
  const skipped = await applyPushFact(priceFact(34000), {
    ledger,
    deliver: async () => {
      called = true;
      throw new Error('delivered');
    },
  });
  assert.equal(skipped.reason, 'first_seen');
  const drop = await applyPushFact(priceFact(33000), {
    ledger,
    deliver: async () => {
      called = true;
      throw new Error('delivered');
    },
  });
  assert.equal(drop.reason, 'disabled');
  assert.equal(called, false);
});

test('price and offer triggers no-op when Firebase credentials are unset', async () => {
  const ledger = createMemoryPushLedger();
  await applyPushFact(priceFact(35250), {
    ledger,
    deliver: async () => {
      throw new Error('baseline should not send');
    },
  });
  let called = false;
  const result = await applyPushFact(priceFact(34850), {
    ledger,
    deliver: (push) => deliverShopperPush(push, {
      tokens: async () => ['device-token-1234567890'],
      send: (message) => sendPush(message, {
        env: {},
        fetch: (() => {
          called = true;
          return Promise.reject(new Error('called'));
        }) as typeof fetch,
      }),
    }),
  });
  assert.equal(result.reason, 'unconfigured');
  assert.equal(result.delivered, 0);
  assert.equal(called, false);
  assert.equal((result.body ?? '').includes('Lakeside'), false);
  assert.equal((result.body ?? '').toLowerCase().includes('transparency'), true);
});

test('trigger facts reject a custom message and the ledger stays in memory', () => {
  const fact = readPushFact({
    type: 'listing_price',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
    price: 34850,
    title: 'Negotiate with Lakeside Toyota',
    body: `Call ${PHONE}`,
    dealerName: DEALER,
    vehicle: VEHICLE,
  }, '2026-10-15T12:00:00.000Z');
  assert.equal(fact.type, 'listing_price');
  assert.equal('title' in fact, false);
  assert.equal('body' in fact, false);
  assert.throws(() => readPushFact({ type: 'negotiate', userId: USER, dealId: DEAL, listingId: 'mc-rav4' }, '2026-10-15T12:00:00.000Z'));

  const memory = createMemoryPushLedger();
  let opened = false;
  const selected = selectPushLedger({}, memory, () => {
    opened = true;
    return { source: 'supabase' } as PushLedger;
  });
  assert.equal(selected, memory);
  assert.equal(opened, false);
  const supabase = { source: 'supabase' } as PushLedger;
  assert.equal(selectPushLedger({ SHOPPER_PUSH_STORE: 'supabase' }, memory, () => supabase), supabase);

  const sql = readFileSync(join(HERE, '../../../db/shopper_push_triggers.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /price_drops boolean not null default true/);
  assert.match(sql, /Shoppers read own push preferences/);
  assert.match(sql, /Shoppers insert own push preferences/);
  assert.match(sql, /Shoppers update own push preferences/);
  assert.match(sql, /with check/);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id/);
  assert.equal(sql.includes('dealer_name'), false);
  assert.equal(sql.includes('to anon'), false);
  assert.equal(/negotiat/i.test(sql), false);

  const cron = readFileSync(join(HERE, '../../app/api/cron/push-triggers/route.ts'), 'utf8');
  const prefs = readFileSync(join(HERE, '../../app/api/consumer/push/preferences/route.ts'), 'utf8');
  assert.match(cron, /DREVVY_CRON_SECRET/);
  assert.match(cron, /status: 404/);
  assert.equal(cron.includes('requireShopperAuth'), false);
  assert.match(prefs, /requireShopperAuth\(/);
  assert.match(prefs, /priceDrops/);
  assert.equal(/negotiat/i.test(cron + prefs), false);
});

function priceFact(price: number): PushFact {
  return {
    type: 'listing_price',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
    price,
    vehicle: VEHICLE,
    dealerName: `${DEALER} ${EMAIL}`,
    observedAt: '2026-10-15T12:00:00.000Z',
  };
}

function offerFact(amount: number): PushFact {
  return {
    type: 'offer_ready',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
    amount,
    vehicle: VEHICLE,
    dealerName: DEALER,
    observedAt: '2026-10-15T12:00:00.000Z',
  };
}
