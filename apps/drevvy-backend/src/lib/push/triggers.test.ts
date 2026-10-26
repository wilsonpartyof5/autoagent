import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { readAgentEvent } from '@/lib/shopper/lifecycle';

import { deliverShopperPush } from './dispatch';
import { sendPush } from './send';
import {
  PRICE_DROPS_DEFAULT_ON,
  planShopperPush,
  pushPrefs,
  readRevealedDealerName,
  type PushTrigger,
} from './triggers';

type PriceDropTrigger = Extract<PushTrigger, { kind: 'price_drop' }>;

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = '22222222-2222-4222-8222-222222222222';
const DEAL = '11111111-1111-4111-8111-111111111111';

const IDENTITY = {
  dealerName: 'Lakeside Toyota',
  dealerPhone: '704-555-0199',
  dealerEmail: 'sales@lakeside.example',
  dealerWebsite: 'https://lakeside.example',
  street: '100 Dealer Way',
};

test('price-drop pushes are on unless the preference is false', () => {
  assert.equal(PRICE_DROPS_DEFAULT_ON, true);
  assert.equal(pushPrefs(undefined).priceDrops, true);
  assert.equal(pushPrefs({}).priceDrops, true);
  assert.equal(pushPrefs({ priceDrops: false }).priceDrops, false);

  const base = drop();
  const sent = planShopperPush(base);
  assert.ok(sent);
  assert.equal(sent.title, 'Dealer A dropped $400 on your RAV4');
  assert.equal(sent.body, 'Vehicle price now $36,450. Tap to review.');
  assert.equal(planShopperPush({ ...base, prefs: { priceDrops: false } }), null);
  assert.equal(planShopperPush({ ...base, previousPrice: 36450, price: 36850 }), null);
  assert.equal(planShopperPush({ ...base, previousPrice: 36450, price: 36450 }), null);

  const hidden = planShopperPush({ ...base, prefs: { hidePrices: true } });
  assert.equal(hidden?.title, 'Dealer A dropped the price on your RAV4');
  assert.equal(/\$\d/.test(`${hidden?.title} ${hidden?.body}`), false);
  assert.equal(planShopperPush({ ...base, dealerAlias: 'Lakeside Toyota' })?.title.startsWith('The price dropped'), true);
});

test('dealer identity stays out of pushes until the official offer is forwarded', () => {
  const triggers: PushTrigger[] = [
    drop(),
    {
      kind: 'offer_ready',
      userId: USER,
      dealId: DEAL,
      listingId: 'mc-rav4',
      vehicle: { model: 'RAV4' },
      otd: 37824,
      identity: IDENTITY,
    },
    {
      kind: 'car_sold',
      userId: USER,
      dealId: DEAL,
      vehicle: { model: 'RAV4' },
      identity: IDENTITY,
    },
    {
      kind: 'official_offer',
      userId: USER,
      dealId: DEAL,
      vehicle: { model: 'RAV4' },
      offerForwarded: false,
      identity: IDENTITY,
    },
    {
      kind: 'did_you_buy',
      source: 'pickup_fallback',
      userId: USER,
      dealId: DEAL,
      vehicle: { model: 'RAV4' },
      identity: IDENTITY,
    },
    {
      kind: 'did_you_buy',
      source: 'geofence_exit',
      userId: USER,
      dealId: DEAL,
      vehicle: { model: 'RAV4' },
      identity: IDENTITY,
    },
    {
      kind: 'no_response',
      userId: USER,
      dealId: DEAL,
      vehicle: { model: 'RAV4' },
      dealerAlias: 'Dealer A',
      identity: IDENTITY,
    },
  ];

  const planned = triggers.map((trigger) => planShopperPush(trigger));
  assert.equal(planned[5], null);
  for (const push of planned) {
    if (!push) continue;
    const text = `${push.title} ${push.body}`;
    assert.equal(/lakeside|704-555-0199|sales@|dealer way|https?:/i.test(text), false, push.event);
    assert.equal(/negotiat/i.test(text), false, push.event);
  }

  const offer = planned[1];
  assert.equal(offer?.body, 'A new offer is ready on your RAV4. $37,824 out the door.');
  const sold = planned[2];
  assert.equal(sold?.title, 'Your RAV4 is no longer listed');
  assert.match(sold?.body ?? '', /add another and keep going/);
  assert.equal(/just sold/i.test(sold?.body ?? ''), false);
  assert.equal(planned[3]?.body, 'Your official offer is in. Open it for the price.');
  assert.equal(planned[4]?.title, 'Did you buy it?');
  assert.match(planned[4]?.body ?? '', /Did you buy the RAV4/);
  assert.equal(planned[6]?.title, 'Your key is back');
  assert.match(planned[6]?.body ?? '', /Dealer A didn't respond, so your dealer-conversation key is back/);

  const revealed = planShopperPush({
    kind: 'official_offer',
    userId: USER,
    dealId: DEAL,
    offerForwarded: true,
    identity: IDENTITY,
    vehicle: { model: 'RAV4' },
  });
  assert.equal(revealed?.body, 'Official offer from Lakeside Toyota is in your inbox.');
  assert.equal(/704-555-0199|sales@|dealer way|https?:/i.test(revealed?.body ?? ''), false);
  assert.equal(readRevealedDealerName({
    dealerName: 'Lakeside Toyota',
    street: '100 Dealer Way',
    dealerEmail: 'sales@lakeside.example',
  }), 'Lakeside Toyota');
  assert.equal(readRevealedDealerName({ dealerName: 'sales@lakeside.example' }), null);
  assert.equal(readRevealedDealerName({ dealerName: '100 Dealer Way' }), null);

  const disguised = planShopperPush({ ...drop(), vehicle: { model: 'Lakeside Toyota' } });
  assert.match(disguised?.title ?? '', /your car/);
  assert.equal(/lakeside/i.test(disguised?.title ?? ''), false);
});

test('a triggered push is a no-op when Firebase credentials are unset', async () => {
  const planned = planShopperPush(drop());
  assert.ok(planned);
  let called = false;
  const report = await deliverShopperPush(planned, {
    tokens: async () => ['device-token-1234567890'],
    send: (message) => sendPush(message, {
      env: {},
      fetch: () => {
        called = true;
        return Promise.reject(new Error('called'));
      },
    }),
  });
  assert.equal(called, false);
  assert.equal(report.reason, 'unconfigured');
  assert.equal(report.delivered, 0);
  assert.equal(report.title, planned.title);
  assert.equal(report.body.includes('Lakeside'), false);
});

test('deal events parse a price drop as on and the cron routes send through FCM', () => {
  const event = readAgentEvent({
    type: 'price_drop',
    dealId: DEAL,
    consumerUserId: USER,
    price: 36000,
    dealerName: 'Lakeside Toyota',
  }, '2026-10-15T12:00:00.000Z');
  assert.equal(event.type, 'price_drop');
  if (event.type === 'price_drop') {
    assert.equal(event.priceDrops, true);
    assert.equal(event.identity.dealerName, 'Lakeside Toyota');
  }
  const off = readAgentEvent({
    type: 'price_drop',
    dealId: DEAL,
    consumerUserId: USER,
    price: 36000,
    priceDrops: false,
  }, '2026-10-15T12:00:00.000Z');
  assert.equal(off.type === 'price_drop' && off.priceDrops, false);

  const events = readFileSync(join(HERE, '../../app/api/cron/deal-events/route.ts'), 'utf8');
  const lifecycle = readFileSync(join(HERE, '../../app/api/cron/deal-lifecycle/route.ts'), 'utf8');
  const forwarded = readFileSync(join(HERE, '../../app/api/consumer/deals/[id]/offer-forwarded/route.ts'), 'utf8');
  assert.match(events, /shopperDeps\(/);
  assert.match(events, /priceDrops/);
  assert.match(lifecycle, /notify: deps\.notify/);
  assert.match(lifecycle, /DREVVY_CRON_SECRET/);
  assert.match(forwarded, /readRevealedDealerName/);
  assert.equal(/negotiat/i.test(events + lifecycle + forwarded), false);
});

function drop(): PriceDropTrigger {
  return {
    kind: 'price_drop',
    userId: USER,
    dealId: DEAL,
    listingId: 'mc-rav4',
    vehicle: { model: 'RAV4' },
    previousPrice: 36850,
    price: 36450,
    dealerAlias: 'Dealer A',
    identity: IDENTITY,
  };
}
