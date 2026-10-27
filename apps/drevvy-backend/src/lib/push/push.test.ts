import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { deliverShopperPush } from './dispatch';
import {
  PUSH_EVENTS,
  pushCopy,
  readCronPush,
  readDemoPush,
} from './events';
import { readDeviceToken } from './tokens';
import { readFcmConfig, sendPush, type SendPushDeps } from './send';

const HERE = dirname(fileURLToPath(import.meta.url));
const USER = '22222222-2222-4222-8222-222222222222';

test('push copy shares one wording and never says negotiate', () => {
  for (const event of PUSH_EVENTS) {
    const copy = pushCopy(event);
    assert.equal(copy.title.length > 0 && copy.body.length > 0, true, event);
    assert.equal(/negotiat/i.test(`${copy.title} ${copy.body}`), false, event);
    assert.equal(copy.body.toLowerCase().includes('transparency'), false, event);
  }
  assert.equal(pushCopy('did_you_buy').title, 'Did you buy it?');
  assert.equal(pushCopy('did_you_buy').body, 'Tell Drevvy whether you bought this car.');
  assert.equal(pushCopy('price_drop').body, 'Tap to see the new price.');
  assert.equal(pushCopy('offer_ready').body, 'A new offer is ready on your car. Tap to review.');
  assert.equal(pushCopy('no_response').title, 'Your key is back');
  assert.match(pushCopy('no_response').body, /Your dealer didn't respond, so your dealer-conversation key is back/);
});

test('demo and cron events reject a custom message', () => {
  const demo = readDemoPush({ event: 'price_drop', title: 'Negotiate now', userId: 'someone-else' });
  assert.equal(demo.event, 'price_drop');
  assert.equal('userId' in demo, false);
  assert.equal(readCronPush({ event: 'offer_ready', userId: USER }).userId, USER);
  assert.throws(() => readCronPush({ event: 'negotiate', userId: USER }));
  assert.equal(readDeviceToken({ token: 'a'.repeat(32) }), 'a'.repeat(32));
  assert.throws(() => readDeviceToken({ token: 'short' }));
});

test('sendPush is a no-op when FCM env is unset', async () => {
  let called = false;
  const result = await sendPush(
    { token: 'device-token-1234567890', title: 'Price dropped', body: 'Open it for transparency.' },
    { env: {}, fetch: (() => { called = true; return Promise.reject(new Error('called')); }) as typeof fetch },
  );
  assert.deepEqual(result, { delivered: false, reason: 'unconfigured' });
  assert.equal(called, false);
  assert.equal(readFcmConfig({ FCM_PROJECT_ID: 'drevvy', FCM_CLIENT_EMAIL: 'a@b.c' }), null);
});

test('sendPush uses FCM HTTP v1 and an APNs alert', async () => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const calls: { url: string; body: string; authorization: string | null }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      body: String(init?.body ?? ''),
      authorization: headers.get('authorization'),
    });
    if (url.includes('oauth2.googleapis.com')) {
      return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 });
    }
    return new Response(JSON.stringify({ name: 'projects/drevvy/messages/1' }), { status: 200 });
  };
  const deps: SendPushDeps = {
    env: {
      FCM_PROJECT_ID: 'drevvy',
      FCM_CLIENT_EMAIL: 'push@drevvy.iam.gserviceaccount.com',
      FCM_PRIVATE_KEY: pem.replace(/\n/g, '\\n'),
    },
    fetch: fetchImpl,
    now: new Date('2026-10-14T12:00:00.000Z'),
    cache: new Map(),
  };
  const result = await sendPush({
    token: 'device-token-1234567890',
    title: 'Price dropped',
    body: 'Open the car for transparency on the new number.',
    data: { event: 'price_drop' },
  }, deps);
  assert.deepEqual(result, { delivered: true, messageId: 'projects/drevvy/messages/1' });
  assert.equal(calls[0]?.url, 'https://oauth2.googleapis.com/token');
  assert.match(calls[0]?.body ?? '', /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
  assert.equal(calls[1]?.url, 'https://fcm.googleapis.com/v1/projects/drevvy/messages:send');
  assert.equal(calls[1]?.authorization, 'Bearer ya29.test');
  const message = JSON.parse(calls[1]?.body ?? '{}').message;
  assert.equal(message.token, 'device-token-1234567890');
  assert.equal(message.apns.payload.aps.alert.title, 'Price dropped');
  assert.equal(message.apns.headers['apns-push-type'], 'alert');
  assert.equal(message.data.event, 'price_drop');
  assert.equal(/negotiat/i.test(calls[1]?.body ?? ''), false);

  const cached = await sendPush({
    token: 'device-token-1234567890',
    title: 'Offer ready',
    body: 'Open it for transparency on the price.',
  }, deps);
  assert.equal(cached.delivered, true);
  assert.equal(calls.length, 3);
});

test('delivery fans out to the shopper\'s devices and skips an empty list', async () => {
  const empty = await deliverShopperPush(
    { event: 'car_sold', userId: USER },
    { tokens: async () => [], send: async () => ({ delivered: false, reason: 'unconfigured' }) },
  );
  assert.equal(empty.reason, 'no_devices');
  assert.match(empty.body, /add another and keep going/);
  assert.equal(/negotiat/i.test(`${empty.title} ${empty.body}`), false);

  const sent: string[] = [];
  const report = await deliverShopperPush(
    { event: 'official_offer', userId: USER, listingId: 'mc-listing-1' },
    {
      tokens: async () => ['token-aaaaaaaaaaaaaaaaaaaa', 'token-bbbbbbbbbbbbbbbbbbbb'],
      send: async (message) => {
        sent.push(message.token);
        assert.equal(message.data.event, 'official_offer');
        assert.equal(message.data.listingId, 'mc-listing-1');
        return { delivered: false, reason: 'unconfigured' };
      },
    },
  );
  assert.deepEqual(sent, ['token-aaaaaaaaaaaaaaaaaaaa', 'token-bbbbbbbbbbbbbbbbbbbb']);
  assert.equal(report.reason, 'unconfigured');
  assert.equal(report.targeted, 2);
});

test('device and push routes stay shopper-scoped and the migration is not applied', () => {
  const devices = readFileSync(join(HERE, '../../app/api/consumer/devices/route.ts'), 'utf8');
  const demo = readFileSync(join(HERE, '../../app/api/consumer/push/demo/route.ts'), 'utf8');
  const cron = readFileSync(join(HERE, '../../app/api/cron/push-events/route.ts'), 'utf8');
  assert.match(devices, /requireShopperAuth\(/);
  assert.match(demo, /requireShopperAuth\(/);
  assert.match(cron, /DREVVY_CRON_SECRET/);
  assert.match(cron, /status: 404/);
  assert.equal(/negotiat/i.test(devices + demo + cron), false);

  const sql = readFileSync(join(HERE, '../../../../../supabase/migrations/20261017130001_device_tokens.sql'), 'utf8');
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /Shoppers read own device tokens/);
  assert.match(sql, /Shoppers insert own device tokens/);
  assert.match(sql, /Shoppers update own device tokens/);
  assert.match(sql, /with check/);
  assert.match(sql, /Shoppers delete own device tokens/);
  assert.match(sql, /\(select auth\.uid\(\)\) = user_id/);
  assert.match(sql, /grant select, insert, update, delete on public\.device_tokens to authenticated/);
  assert.equal(sql.includes('shopper_credits'), false);
  assert.equal(sql.includes('to anon'), false);
});
