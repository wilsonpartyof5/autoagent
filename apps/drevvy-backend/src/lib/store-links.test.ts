import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deviceCtaMode,
  getSmartLink,
  resolveGetDestination,
  storeUrlsFromEnv,
  type StoreUrls,
} from './store-links';

const APP = 'https://apps.apple.com/app/drevvy/id000000000';
const PLAY = 'https://play.google.com/store/apps/details?id=com.drevvy.app';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 14; Pixel Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const UNKNOWN_PHONE = 'Mozilla/5.0 (Mobile; rv:48.0) Gecko/48.0 Firefox/48.0';

const BOTH: StoreUrls = { appStore: APP, playStore: PLAY };
const NONE: StoreUrls = {};

test('smart link points at /get on the marketing host', () => {
  assert.equal(getSmartLink(), 'https://drevvy.com/get');
  assert.equal(getSmartLink('https://www.drevvy.com/'), 'https://www.drevvy.com/get');
});

test('device CTA shows the matching store, both as fallback, and a QR on desktop', () => {
  assert.equal(deviceCtaMode(IPHONE), 'ios');
  assert.equal(deviceCtaMode(IPAD), 'ios');
  assert.equal(deviceCtaMode(ANDROID_PHONE), 'android');
  assert.equal(deviceCtaMode(ANDROID_TABLET), 'android');
  assert.equal(deviceCtaMode(UNKNOWN_PHONE), 'both');
  assert.equal(deviceCtaMode(DESKTOP), 'qr');
  assert.equal(deviceCtaMode(WINDOWS), 'qr');
  assert.equal(deviceCtaMode(''), 'qr');
  assert.equal(deviceCtaMode('iphone'), 'ios');
});

test('iOS /get redirects to the App Store only when that URL is set', () => {
  assert.deepEqual(resolveGetDestination(IPHONE, BOTH), { kind: 'redirect', url: APP });
  assert.deepEqual(resolveGetDestination(IPHONE, { playStore: PLAY }), {
    kind: 'coming-soon',
    platform: 'ios',
  });
  assert.deepEqual(resolveGetDestination(IPAD, { appStore: APP }), { kind: 'redirect', url: APP });
  assert.deepEqual(resolveGetDestination(IPHONE, NONE), { kind: 'coming-soon', platform: 'ios' });
  assert.deepEqual(resolveGetDestination(IPHONE, { appStore: '   ' }), {
    kind: 'coming-soon',
    platform: 'ios',
  });
});

test('Android /get redirects to Google Play only when that URL is set', () => {
  assert.deepEqual(resolveGetDestination(ANDROID_PHONE, BOTH), { kind: 'redirect', url: PLAY });
  assert.deepEqual(resolveGetDestination(ANDROID_TABLET, { playStore: PLAY }), {
    kind: 'redirect',
    url: PLAY,
  });
  assert.deepEqual(resolveGetDestination(ANDROID_PHONE, { appStore: APP }), {
    kind: 'coming-soon',
    platform: 'android',
  });
  assert.deepEqual(resolveGetDestination(ANDROID_PHONE, NONE), {
    kind: 'coming-soon',
    platform: 'android',
  });
});

test('desktop and other non-phone /get visits return to the landing page', () => {
  assert.deepEqual(resolveGetDestination(DESKTOP, BOTH), { kind: 'landing' });
  assert.deepEqual(resolveGetDestination(WINDOWS, NONE), { kind: 'landing' });
  assert.deepEqual(resolveGetDestination('', BOTH), { kind: 'landing' });
  assert.deepEqual(resolveGetDestination('Googlebot', BOTH), { kind: 'landing' });
});

test('an unrecognized phone gets coming soon only when neither store URL is set', () => {
  assert.deepEqual(resolveGetDestination(UNKNOWN_PHONE, NONE), {
    kind: 'coming-soon',
    platform: 'phone',
  });
  assert.deepEqual(resolveGetDestination(UNKNOWN_PHONE, BOTH), { kind: 'landing' });
  assert.deepEqual(resolveGetDestination(UNKNOWN_PHONE, { appStore: APP }), { kind: 'landing' });
});

test('store URLs must be http(s) and must not point back at /get', () => {
  assert.deepEqual(
    storeUrlsFromEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_STORE_URL: `  ${APP}  `,
      NEXT_PUBLIC_PLAY_STORE_URL: PLAY,
    }),
    { appStore: APP, playStore: PLAY },
  );

  assert.deepEqual(resolveGetDestination(IPHONE, { appStore: 'javascript:alert(1)' }), {
    kind: 'coming-soon',
    platform: 'ios',
  });
  assert.deepEqual(resolveGetDestination(ANDROID_PHONE, { playStore: 'not a url' }), {
    kind: 'coming-soon',
    platform: 'android',
  });
  assert.deepEqual(resolveGetDestination(IPHONE, { appStore: 'https://www.drevvy.com/get' }), {
    kind: 'coming-soon',
    platform: 'ios',
  });
  assert.deepEqual(resolveGetDestination(ANDROID_PHONE, { playStore: 'https://drevvy.com/get/' }), {
    kind: 'coming-soon',
    platform: 'android',
  });

  assert.deepEqual(
    storeUrlsFromEnv({
      NODE_ENV: 'test',
      NEXT_PUBLIC_APP_STORE_URL: '',
      NEXT_PUBLIC_PLAY_STORE_URL: 'ftp://files.example/app',
    }),
    {},
  );
});
