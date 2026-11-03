import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANDROID_SHOPPER_PACKAGE,
  appleAndroidIntentLocation,
} from './apple-android-callback';

test('android apple callback targets the shopper package and keeps the token', () => {
  const location = appleAndroidIntentLocation([
    ['id_token', 'a.b.c'],
    ['state', 'state-1'],
    ['code', 'auth-code'],
    ['user', '{"name":{"firstName":"Dana"}}'],
  ]);

  assert.equal(ANDROID_SHOPPER_PACKAGE, 'com.drevvy.drevvy_app');
  assert.match(location, /^intent:\/\/callback\?/);
  assert.match(location, /#Intent;package=com\.drevvy\.drevvy_app;scheme=signinwithapple;end$/);
  const query = new URL(location.replace('intent://', 'https://')).searchParams;
  assert.equal(query.get('id_token'), 'a.b.c');
  assert.equal(query.get('state'), 'state-1');
  assert.equal(query.get('code'), 'auth-code');
});

test('android apple callback drops unexpected fields', () => {
  const location = appleAndroidIntentLocation([
    ['id_token', 'a.b.c'],
    ['email', 'shopper@example.com'],
    ['redirect', 'https://evil.example'],
  ]);
  assert.equal(location.includes('email'), false);
  assert.equal(location.includes('evil.example'), false);
  assert.match(location, /id_token=a\.b\.c/);
});
